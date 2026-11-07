import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  assignmentFiles,
  assignmentRecipients,
  assignments,
  classPathStations,
  classes,
  enrollments,
  sessions,
  stationSkills,
  submissionFiles,
  submissions,
} from "@/db/schema";
import { fromTehranTime } from "@/lib/format";
import { formatClock, parseClock } from "@/lib/schedule";
import { checkUploads, deleteFiles, MAX_FILES, storeFiles, type FileError } from "../files/storage";
import { HOMEWORK_TYPES } from "./types";
import { assignmentFilesOf, type StoredFile } from "./submissions";

const clean = (max: number, error: string) =>
  z
    .string()
    .trim()
    .max(max, error)
    .transform((v) => v || null);

export const assignmentSchema = z
  .object({
    /** Set when editing an existing item. */
    id: z.uuid().optional(),
    sessionId: z.uuid(),
    type: z.enum(HOMEWORK_TYPES, "type"),
    /** Optional: without one the item is named by `titleFallback`, then by its type. */
    title: z.string().trim().max(120, "title"),
    titleFallback: z.string().trim().max(120).default(""),
    body: clean(4000, "body"),
    /** Tehran calendar date and time of the deadline; both empty means no deadline. */
    dueDate: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "due"),
    dueTime: z.string().transform((v, ctx) => {
      if (!v.trim()) return null;
      const minutes = parseClock(v);
      if (minutes === null) ctx.addIssue({ code: "custom", message: "due" });
      return minutes;
    }),
    /** Empty: every active learner of the class. */
    studentIds: z.array(z.uuid()).max(8),
    stationSkillId: z
      .string()
      .transform((v) => v || null)
      .pipe(z.uuid().nullable()),
    /** Files of the item to keep when editing. */
    keep: z.array(z.uuid()).max(MAX_FILES),
  })
  .refine((v) => Boolean(v.dueDate) === (v.dueTime !== null), {
    message: "due",
    path: ["dueDate"],
  })
  .transform(({ dueDate, dueTime, titleFallback, ...rest }) => ({
    ...rest,
    title: rest.title || titleFallback || rest.type,
    dueAt: dueDate && dueTime !== null ? fromTehranTime(dueDate, formatClock(dueTime)) : null,
  }));
export type AssignmentInput = z.output<typeof assignmentSchema>;

export type AssignError =
  "not_held" | "not_found" | "no_learners" | "learners" | "answered" | "skill" | FileError;
export type AssignResult = { ok: true; id: string } | { ok: false; error: AssignError };

/**
 * Saves (or edits) one homework item of a held session as a draft; learners get it when the
 * teacher sends the page. It is for the chosen learners, or every active learner of the class; an
 * optional skill must belong to the session's station. Any change marks the page "not sent".
 */
export async function saveAssignment(
  teacher: { teacherId: string; userId: string },
  input: AssignmentInput,
  uploads: File[],
): Promise<AssignResult> {
  const [session] = await db
    .select({ classId: sessions.classId, pathStationId: sessions.pathStationId })
    .from(sessions)
    .where(
      and(
        eq(sessions.id, input.sessionId),
        eq(sessions.teacherId, teacher.teacherId),
        eq(sessions.status, "held"),
      ),
    );
  if (!session) return { ok: false, error: "not_held" };

  let before: StoredFile[] = [];
  let answeredBy: string[] = [];
  if (input.id) {
    const [own] = await db
      .select({ id: assignments.id })
      .from(assignments)
      .where(
        and(
          eq(assignments.id, input.id),
          eq(assignments.sessionId, input.sessionId),
          eq(assignments.teacherId, teacher.teacherId),
        ),
      );
    if (!own) return { ok: false, error: "not_found" };
    before = (await assignmentFilesOf([input.id])).get(input.id) ?? [];
    answeredBy = (
      await db
        .select({ studentId: submissions.studentId })
        .from(submissions)
        .where(eq(submissions.assignmentId, input.id))
    ).map((r) => r.studentId);
  }
  const kept = before.filter((f) => input.keep.includes(f.id));
  const fileError = checkUploads(uploads, kept.length);
  if (fileError) return { ok: false, error: fileError };

  const active = (
    await db
      .select({ studentId: enrollments.studentId })
      .from(enrollments)
      .where(and(eq(enrollments.classId, session.classId), eq(enrollments.status, "active")))
  ).map((r) => r.studentId);
  if (!active.length) return { ok: false, error: "no_learners" };
  const chosen = input.studentIds.length ? [...new Set(input.studentIds)] : active;
  if (chosen.some((id) => !active.includes(id))) return { ok: false, error: "learners" };
  // Someone who already answered keeps the item.
  if (answeredBy.some((id) => !chosen.includes(id))) return { ok: false, error: "answered" };

  if (input.stationSkillId) {
    const [skill] = session.pathStationId
      ? await db
          .select({ id: stationSkills.id })
          .from(stationSkills)
          .innerJoin(classPathStations, eq(classPathStations.stationId, stationSkills.stationId))
          .where(
            and(
              eq(stationSkills.id, input.stationSkillId),
              eq(classPathStations.id, session.pathStationId),
            ),
          )
      : [];
    if (!skill) return { ok: false, error: "skill" };
  }

  const added = await storeFiles(teacher.userId, uploads);
  const dropped = before.filter((f) => !kept.includes(f)).map((f) => f.id);
  const values = {
    type: input.type,
    title: input.title,
    body: input.body,
    dueAt: input.dueAt,
    stationSkillId: input.stationSkillId,
  };
  try {
    const id = await db.transaction(async (tx) => {
      const [row] = input.id
        ? await tx
            .update(assignments)
            .set(values)
            .where(eq(assignments.id, input.id))
            .returning({ id: assignments.id })
        : await tx
            .insert(assignments)
            .values({ ...values, teacherId: teacher.teacherId, sessionId: input.sessionId })
            .returning({ id: assignments.id });
      await tx
        .update(sessions)
        .set({ afterClassSentAt: null })
        .where(eq(sessions.id, input.sessionId));
      await tx.delete(assignmentRecipients).where(eq(assignmentRecipients.assignmentId, row.id));
      await tx
        .insert(assignmentRecipients)
        .values(chosen.map((studentId) => ({ assignmentId: row.id, studentId })));
      if (dropped.length)
        await tx.delete(assignmentFiles).where(inArray(assignmentFiles.fileId, dropped));
      if (added.length)
        await tx
          .insert(assignmentFiles)
          .values(added.map((fileId) => ({ assignmentId: row.id, fileId })));
      return row.id;
    });
    await deleteFiles(dropped);
    return { ok: true, id };
  } catch (error) {
    await deleteFiles(added);
    throw error;
  }
}

/** Deletes the assignment with every answer and file that belongs to it. */
export async function deleteAssignment(teacherId: string, id: string): Promise<boolean> {
  const own = and(eq(assignments.id, id), eq(assignments.teacherId, teacherId));
  const [exists] = await db
    .select({ id: assignments.id, sessionId: assignments.sessionId })
    .from(assignments)
    .where(own);
  if (!exists) return false;
  const [given, answered] = await Promise.all([
    db
      .select({ id: assignmentFiles.fileId })
      .from(assignmentFiles)
      .where(eq(assignmentFiles.assignmentId, id)),
    db
      .select({ id: submissionFiles.fileId })
      .from(submissionFiles)
      .innerJoin(submissions, eq(submissions.id, submissionFiles.submissionId))
      .where(eq(submissions.assignmentId, id)),
  ]);
  await db.delete(assignments).where(own);
  await db
    .update(sessions)
    .set({ afterClassSentAt: null })
    .where(eq(sessions.id, exists.sessionId));
  await deleteFiles([...given, ...answered].map((f) => f.id));
  return true;
}

export type AssignTarget = {
  id: string;
  nameFa: string;
  nameEn: string | null;
  learnerCount: number;
  /** When the class next meets: the default deadline is an hour before. */
  nextStartsAt: Date | null;
  /** Held sessions, newest first. */
  sessions: { id: string; number: number; startsAt: Date }[];
};

/** Classes that can get homework: they have a held session. */
export async function assignTargets(teacherId: string, now = new Date()): Promise<AssignTarget[]> {
  const rows = await db
    .select({
      id: sessions.id,
      classId: sessions.classId,
      kind: sessions.kind,
      status: sessions.status,
      startsAt: sessions.startsAt,
    })
    .from(sessions)
    .innerJoin(classes, eq(classes.id, sessions.classId))
    .where(and(eq(sessions.teacherId, teacherId), sql`${classes.archivedAt} is null`))
    .orderBy(asc(sessions.startsAt));
  const held = [...new Set(rows.filter((s) => s.status === "held").map((s) => s.classId))];
  if (!held.length) return [];
  const [cls, learners] = await Promise.all([
    db
      .select({ id: classes.id, nameFa: classes.nameFa, nameEn: classes.nameEn })
      .from(classes)
      .where(inArray(classes.id, held))
      .orderBy(desc(classes.createdAt)),
    db
      .select({ classId: enrollments.classId, count: sql<number>`count(*)::int` })
      .from(enrollments)
      .where(and(inArray(enrollments.classId, held), eq(enrollments.status, "active")))
      .groupBy(enrollments.classId),
  ]);
  return cls.map((c) => {
    const mine = rows.filter((s) => s.classId === c.id);
    const numbered = mine.filter((s) => s.kind === "class").map((s) => s.id);
    return {
      ...c,
      learnerCount: learners.find((l) => l.classId === c.id)?.count ?? 0,
      nextStartsAt:
        mine.find((s) => s.status === "scheduled" && s.startsAt > now)?.startsAt ?? null,
      sessions: mine
        .filter((s) => s.status === "held")
        .map((s) => ({ id: s.id, number: numbered.indexOf(s.id) + 1, startsAt: s.startsAt }))
        .reverse(),
    };
  });
}

export type OpenAssignment = {
  id: string;
  title: string;
  dueAt: Date | null;
  classNameFa: string;
  classNameEn: string | null;
  sessionNumber: number;
  recipients: number;
  handedIn: number;
};

export type HomeworkStats = {
  toReview: number;
  oldestToReview: Date | null;
  needsRevision: number;
  reviewed: number;
  /** Assignments with a deadline in the next 7 days, and how many of their answers are in. */
  dueThisWeek: number;
  dueThisWeekIn: number;
  dueThisWeekOf: number;
  /** Hand-in rate over assignments given in the last 30 days; null with none. */
  handInRate: number | null;
  assignedLast30: number;
  open: OpenAssignment[];
};

export async function homeworkOverview(
  teacherId: string,
  now = new Date(),
): Promise<HomeworkStats> {
  const day = 24 * 60 * 60 * 1000;
  const [counts, mine, sessionRows] = await Promise.all([
    db
      .select({
        status: submissions.status,
        count: sql<number>`count(*)::int`,
        oldest: sql<Date | null>`min(${submissions.submittedAt})`,
      })
      .from(submissions)
      .innerJoin(assignments, eq(assignments.id, submissions.assignmentId))
      .where(eq(assignments.teacherId, teacherId))
      .groupBy(submissions.status),
    db
      .select({
        id: assignments.id,
        title: assignments.title,
        dueAt: assignments.dueAt,
        createdAt: assignments.createdAt,
        sessionId: assignments.sessionId,
        classNameFa: classes.nameFa,
        classNameEn: classes.nameEn,
        recipients: sql<number>`(select count(*)::int from ${assignmentRecipients} r where r.assignment_id = "assignments"."id")`,
        handedIn: sql<number>`(select count(*)::int from ${submissions} s where s.assignment_id = "assignments"."id")`,
      })
      .from(assignments)
      .innerJoin(sessions, eq(sessions.id, assignments.sessionId))
      .innerJoin(classes, eq(classes.id, sessions.classId))
      .where(and(eq(assignments.teacherId, teacherId), isNotNull(assignments.publishedAt)))
      .orderBy(desc(assignments.createdAt)),
    db
      .select({ id: sessions.id, classId: sessions.classId, kind: sessions.kind })
      .from(sessions)
      .where(eq(sessions.teacherId, teacherId))
      .orderBy(asc(sessions.startsAt)),
  ]);
  const by = (s: string) => counts.find((c) => c.status === s);
  const numberOf = (sessionId: string) => {
    const s = sessionRows.find((r) => r.id === sessionId);
    return (
      sessionRows
        .filter((r) => r.classId === s?.classId && r.kind === "class")
        .findIndex((r) => r.id === sessionId) + 1
    );
  };

  const week = mine.filter(
    (a) => a.dueAt && a.dueAt >= now && a.dueAt.getTime() < now.getTime() + 7 * day,
  );
  const recent = mine.filter((a) => a.createdAt.getTime() >= now.getTime() - 30 * day);
  const expected = recent.reduce((sum, a) => sum + a.recipients, 0);
  return {
    toReview: by("submitted")?.count ?? 0,
    oldestToReview: by("submitted")?.oldest ? new Date(by("submitted")!.oldest!) : null,
    needsRevision: by("needs_revision")?.count ?? 0,
    reviewed: by("reviewed")?.count ?? 0,
    dueThisWeek: week.length,
    dueThisWeekIn: week.reduce((sum, a) => sum + a.handedIn, 0),
    dueThisWeekOf: week.reduce((sum, a) => sum + a.recipients, 0),
    handInRate: expected
      ? Math.round((recent.reduce((s, a) => s + a.handedIn, 0) / expected) * 100)
      : null,
    assignedLast30: recent.length,
    open: mine
      .filter((a) => !a.dueAt || a.dueAt >= now)
      .slice(0, 8)
      .map((a) => ({
        id: a.id,
        title: a.title,
        dueAt: a.dueAt,
        classNameFa: a.classNameFa,
        classNameEn: a.classNameEn,
        sessionNumber: numberOf(a.sessionId),
        recipients: a.recipients,
        handedIn: a.handedIn,
      })),
  };
}
