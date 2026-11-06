import { and, asc, eq, gt, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  assignmentFiles,
  assignmentRecipients,
  assignments,
  classes,
  files,
  sessions,
  students,
  submissionFiles,
  submissions,
  teachers,
} from "@/db/schema";
import type { HomeworkType } from "./types";
import { checkUploads, deleteFiles, MAX_FILES, storeFiles, type FileError } from "../files/storage";

type Status = (typeof submissions.$inferSelect)["status"];

export type StoredFile = { id: string; name: string; mime: string; size: number };

const fileColumns = {
  id: files.id,
  name: files.originalName,
  mime: files.mime,
  size: files.sizeBytes,
};

async function filesOf(
  join: typeof assignmentFiles | typeof submissionFiles,
  ownerIds: string[],
): Promise<Map<string, StoredFile[]>> {
  const out = new Map<string, StoredFile[]>();
  if (!ownerIds.length) return out;
  const key =
    join === assignmentFiles ? assignmentFiles.assignmentId : submissionFiles.submissionId;
  const rows = await db
    .select({ owner: key, ...fileColumns })
    .from(join)
    .innerJoin(files, eq(files.id, join.fileId))
    .where(inArray(key, ownerIds))
    .orderBy(asc(files.createdAt));
  for (const { owner, ...file } of rows) out.set(owner, [...(out.get(owner) ?? []), file]);
  return out;
}

export const assignmentFilesOf = (ids: string[]) => filesOf(assignmentFiles, ids);
const submissionFilesOf = (ids: string[]) => filesOf(submissionFiles, ids);

const isLate = (submittedAt: Date, dueAt: Date | null) => Boolean(dueAt && submittedAt > dueAt);

// ───────────────────────── Teacher ─────────────────────────

export type QueueRow = {
  id: string;
  status: Status;
  revision: number;
  late: boolean;
  submittedAt: Date;
  hasText: boolean;
  files: StoredFile[];
  title: string;
  fullNameFa: string;
  fullNameEn: string | null;
  classNameFa: string;
  classNameEn: string | null;
};

const queueOrder = [asc(submissions.submittedAt), asc(submissions.id)];

/** Answers in one status, oldest first (the review queue's order). */
export async function reviewQueue(teacherId: string, status: Status): Promise<QueueRow[]> {
  const rows = await db
    .select({
      id: submissions.id,
      status: submissions.status,
      revision: submissions.revision,
      submittedAt: submissions.submittedAt,
      body: submissions.body,
      dueAt: assignments.dueAt,
      title: assignments.title,
      fullNameFa: students.fullNameFa,
      fullNameEn: students.fullNameEn,
      classNameFa: classes.nameFa,
      classNameEn: classes.nameEn,
    })
    .from(submissions)
    .innerJoin(assignments, eq(assignments.id, submissions.assignmentId))
    .innerJoin(students, eq(students.id, submissions.studentId))
    .innerJoin(sessions, eq(sessions.id, assignments.sessionId))
    .innerJoin(classes, eq(classes.id, sessions.classId))
    .where(and(eq(assignments.teacherId, teacherId), eq(submissions.status, status)))
    .orderBy(...queueOrder);
  const attached = await submissionFilesOf(rows.map((r) => r.id));
  return rows.map(({ body, dueAt, ...r }) => ({
    ...r,
    late: isLate(r.submittedAt, dueAt),
    hasText: Boolean(body),
    files: attached.get(r.id) ?? [],
  }));
}

export type ReviewDetail = {
  id: string;
  status: Status;
  revision: number;
  late: boolean;
  submittedAt: Date;
  body: string | null;
  feedback: string | null;
  files: StoredFile[];
  fullNameFa: string;
  fullNameEn: string | null;
  assignment: { title: string; body: string | null; files: StoredFile[] };
  classNameFa: string;
  classNameEn: string | null;
  sessionNumber: number;
  /** Position in the to-review queue, with its neighbours; null unless this answer is in it. */
  queue: {
    position: number;
    total: number;
    previousId: string | null;
    nextId: string | null;
  } | null;
};

export async function getReview(teacherId: string, id: string): Promise<ReviewDetail | null> {
  const [row] = await db
    .select({
      id: submissions.id,
      status: submissions.status,
      revision: submissions.revision,
      submittedAt: submissions.submittedAt,
      body: submissions.body,
      feedback: submissions.feedback,
      assignmentId: assignments.id,
      sessionId: assignments.sessionId,
      classId: sessions.classId,
      dueAt: assignments.dueAt,
      title: assignments.title,
      assignmentBody: assignments.body,
      fullNameFa: students.fullNameFa,
      fullNameEn: students.fullNameEn,
      classNameFa: classes.nameFa,
      classNameEn: classes.nameEn,
    })
    .from(submissions)
    .innerJoin(assignments, eq(assignments.id, submissions.assignmentId))
    .innerJoin(students, eq(students.id, submissions.studentId))
    .innerJoin(sessions, eq(sessions.id, assignments.sessionId))
    .innerJoin(classes, eq(classes.id, sessions.classId))
    .where(and(eq(submissions.id, id), eq(assignments.teacherId, teacherId)));
  if (!row) return null;

  const [answerFiles, givenFiles, classSessions, queue] = await Promise.all([
    submissionFilesOf([row.id]),
    assignmentFilesOf([row.assignmentId]),
    db
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(eq(sessions.classId, row.classId), eq(sessions.kind, "class")))
      .orderBy(asc(sessions.startsAt)),
    row.status === "submitted" ? reviewQueue(teacherId, "submitted") : Promise.resolve([]),
  ]);
  const at = queue.findIndex((q) => q.id === id);
  return {
    id: row.id,
    status: row.status,
    revision: row.revision,
    late: isLate(row.submittedAt, row.dueAt),
    submittedAt: row.submittedAt,
    body: row.body,
    feedback: row.feedback,
    files: answerFiles.get(row.id) ?? [],
    fullNameFa: row.fullNameFa,
    fullNameEn: row.fullNameEn,
    assignment: {
      title: row.title,
      body: row.assignmentBody,
      files: givenFiles.get(row.assignmentId) ?? [],
    },
    classNameFa: row.classNameFa,
    classNameEn: row.classNameEn,
    sessionNumber: classSessions.findIndex((s) => s.id === row.sessionId) + 1,
    queue:
      at < 0
        ? null
        : {
            position: at + 1,
            total: queue.length,
            previousId: queue[at - 1]?.id ?? null,
            nextId: queue[at + 1]?.id ?? null,
          },
  };
}

export const reviewSchema = z.object({
  id: z.uuid(),
  decision: z.enum(["reviewed", "needs_revision"]),
  feedback: z.string().trim().max(2000, "feedback"),
});
export type ReviewInput = z.output<typeof reviewSchema>;

export type ReviewResult =
  { ok: true; nextId: string | null } | { ok: false; error: "not_found" | "feedback_required" };

/**
 * Sends the teacher's text feedback to the learner: reviewed, or back for another try (feedback
 * required). Works on an answer already reviewed too, to change the feedback.
 */
export async function reviewSubmission(
  teacherId: string,
  input: ReviewInput,
  now = new Date(),
): Promise<ReviewResult> {
  if (input.decision === "needs_revision" && !input.feedback)
    return { ok: false, error: "feedback_required" };
  const [target] = await db
    .select({ id: submissions.id, submittedAt: submissions.submittedAt })
    .from(submissions)
    .innerJoin(assignments, eq(assignments.id, submissions.assignmentId))
    .where(and(eq(submissions.id, input.id), eq(assignments.teacherId, teacherId)));
  if (!target) return { ok: false, error: "not_found" };
  await db
    .update(submissions)
    .set({
      status: input.decision,
      feedback: input.feedback || null,
      reviewedAt: input.decision === "reviewed" ? now : null,
    })
    .where(eq(submissions.id, input.id));

  const [next] = await db
    .select({ id: submissions.id })
    .from(submissions)
    .innerJoin(assignments, eq(assignments.id, submissions.assignmentId))
    .where(
      and(
        eq(assignments.teacherId, teacherId),
        eq(submissions.status, "submitted"),
        ne(submissions.id, input.id),
        gt(submissions.submittedAt, target.submittedAt),
      ),
    )
    .orderBy(...queueOrder)
    .limit(1);
  return { ok: true, nextId: next?.id ?? null };
}

/** The teacher's to-review count (the nav badge). */
export async function toReviewCount(teacherId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(submissions)
    .innerJoin(assignments, eq(assignments.id, submissions.assignmentId))
    .where(and(eq(assignments.teacherId, teacherId), eq(submissions.status, "submitted")));
  return row.count;
}

// ───────────────────────── Learner ─────────────────────────

const studentOf = async (userId: string) =>
  (await db.select({ id: students.id }).from(students).where(eq(students.userId, userId)))[0]?.id ??
  null;

export type LearnerHomework = {
  id: string;
  classId: string;
  type: HomeworkType;
  title: string;
  dueAt: Date | null;
  classNameFa: string;
  classNameEn: string | null;
  teacherNameFa: string;
  teacherNameEn: string;
  status: Status | null;
  feedback: string | null;
  submittedAt: Date | null;
  late: boolean;
};

const learnerRows = (studentId: string) =>
  db
    .select({
      id: assignments.id,
      type: assignments.type,
      title: assignments.title,
      dueAt: assignments.dueAt,
      createdAt: assignments.createdAt,
      classId: classes.id,
      classNameFa: classes.nameFa,
      classNameEn: classes.nameEn,
      teacherNameFa: teachers.nameFa,
      teacherNameEn: teachers.nameEn,
      status: submissions.status,
      feedback: submissions.feedback,
      submittedAt: submissions.submittedAt,
    })
    .from(assignmentRecipients)
    .innerJoin(assignments, eq(assignments.id, assignmentRecipients.assignmentId))
    .innerJoin(sessions, eq(sessions.id, assignments.sessionId))
    .innerJoin(classes, eq(classes.id, sessions.classId))
    .innerJoin(teachers, eq(teachers.id, assignments.teacherId))
    .leftJoin(
      submissions,
      and(
        eq(submissions.assignmentId, assignments.id),
        eq(submissions.studentId, assignmentRecipients.studentId),
      ),
    )
    .where(eq(assignmentRecipients.studentId, studentId));

const toLearnerHomework = (
  r: Awaited<ReturnType<typeof learnerRows>>[number],
): LearnerHomework => ({
  id: r.id,
  classId: r.classId,
  type: r.type,
  title: r.title,
  dueAt: r.dueAt,
  classNameFa: r.classNameFa,
  classNameEn: r.classNameEn,
  teacherNameFa: r.teacherNameFa,
  teacherNameEn: r.teacherNameEn,
  status: r.status,
  feedback: r.feedback,
  submittedAt: r.submittedAt,
  late: Boolean(r.submittedAt) && isLate(r.submittedAt!, r.dueAt),
});

/** Everything given to this learner, newest first. */
export async function learnerHomework(userId: string): Promise<LearnerHomework[]> {
  const studentId = await studentOf(userId);
  if (!studentId) return [];
  const rows = await learnerRows(studentId);
  return rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map(toLearnerHomework);
}

/** Homework this learner still has to hand in (or hand in again); the nav badge. */
export async function dueCount(userId: string): Promise<number> {
  const rows = await learnerHomework(userId);
  return rows.filter((r) => r.status === null || r.status === "needs_revision").length;
}

export type LearnerAssignment = LearnerHomework & {
  body: string | null;
  files: StoredFile[];
  revision: number;
  answer: { id: string; body: string | null; files: StoredFile[] } | null;
};

export async function learnerAssignment(
  userId: string,
  assignmentId: string,
): Promise<LearnerAssignment | null> {
  const studentId = await studentOf(userId);
  if (!studentId) return null;
  const [row] = await learnerRows(studentId).then((rows) =>
    rows.filter((r) => r.id === assignmentId),
  );
  if (!row) return null;
  const [[mine], given] = await Promise.all([
    db
      .select({ id: submissions.id, body: submissions.body, revision: submissions.revision })
      .from(submissions)
      .where(and(eq(submissions.assignmentId, assignmentId), eq(submissions.studentId, studentId))),
    assignmentFilesOf([assignmentId]),
  ]);
  const [{ body }] = await db
    .select({ body: assignments.body })
    .from(assignments)
    .where(eq(assignments.id, assignmentId));
  const answerFiles = mine ? await submissionFilesOf([mine.id]) : new Map<string, StoredFile[]>();
  return {
    ...toLearnerHomework(row),
    body,
    files: given.get(assignmentId) ?? [],
    revision: mine?.revision ?? 0,
    answer: mine ? { id: mine.id, body: mine.body, files: answerFiles.get(mine.id) ?? [] } : null,
  };
}

export const answerSchema = z.object({
  assignmentId: z.uuid(),
  body: z
    .string()
    .trim()
    .max(8000, "body")
    .transform((v) => v || null),
  /** Files of the earlier answer to keep. */
  keep: z.array(z.uuid()).max(MAX_FILES),
});
export type AnswerInput = z.output<typeof answerSchema>;

export type AnswerResult =
  { ok: true } | { ok: false; error: "not_found" | "locked" | "empty" | FileError };

/** A learner hands in (or edits) their answer, until the teacher has reviewed it. */
export async function submitAnswer(
  userId: string,
  input: AnswerInput,
  uploads: File[],
  now = new Date(),
): Promise<AnswerResult> {
  const studentId = await studentOf(userId);
  if (!studentId) return { ok: false, error: "not_found" };
  const [given] = await db
    .select({ id: assignmentRecipients.assignmentId })
    .from(assignmentRecipients)
    .where(
      and(
        eq(assignmentRecipients.assignmentId, input.assignmentId),
        eq(assignmentRecipients.studentId, studentId),
      ),
    );
  if (!given) return { ok: false, error: "not_found" };
  const [earlier] = await db
    .select()
    .from(submissions)
    .where(
      and(eq(submissions.assignmentId, input.assignmentId), eq(submissions.studentId, studentId)),
    );
  if (earlier?.status === "reviewed") return { ok: false, error: "locked" };

  const before = earlier ? ((await submissionFilesOf([earlier.id])).get(earlier.id) ?? []) : [];
  const kept = before.filter((f) => input.keep.includes(f.id));
  const fileError = checkUploads(uploads, kept.length);
  if (fileError) return { ok: false, error: fileError };
  if (!input.body && !kept.length && !uploads.length) return { ok: false, error: "empty" };

  const added = await storeFiles(userId, uploads);
  const dropped = before.filter((f) => !kept.includes(f)).map((f) => f.id);
  try {
    await db.transaction(async (tx) => {
      const values = { body: input.body, status: "submitted" as const, submittedAt: now };
      const [saved] = earlier
        ? await tx
            .update(submissions)
            .set({
              ...values,
              revision:
                earlier.status === "needs_revision" ? earlier.revision + 1 : earlier.revision,
              reviewedAt: null,
            })
            .where(eq(submissions.id, earlier.id))
            .returning({ id: submissions.id })
        : await tx
            .insert(submissions)
            .values({ ...values, assignmentId: input.assignmentId, studentId })
            .returning({ id: submissions.id });
      if (dropped.length)
        await tx.delete(submissionFiles).where(inArray(submissionFiles.fileId, dropped));
      if (added.length)
        await tx
          .insert(submissionFiles)
          .values(added.map((fileId) => ({ submissionId: saved.id, fileId })));
    });
  } catch (error) {
    await deleteFiles(added);
    throw error;
  }
  await deleteFiles(dropped);
  return { ok: true };
}
