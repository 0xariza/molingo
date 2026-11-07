import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import {
  assignmentRecipients,
  assignments,
  classes,
  sessions,
  students,
  submissions,
} from "@/db/schema";
import type { HomeworkType } from "./types";

export type BoardStatus = (typeof submissions.$inferSelect)["status"];

export type BoardLearner = {
  studentId: string;
  fullNameFa: string;
  fullNameEn: string | null;
  /** Null until the learner sends an answer. */
  submissionId: string | null;
  status: BoardStatus | null;
  submittedAt: Date | null;
  late: boolean;
  revision: number;
};

export type BoardHomework = {
  id: string;
  type: HomeworkType;
  title: string;
  learners: BoardLearner[];
};

export type BoardSession = {
  sessionId: string;
  classNameFa: string;
  classNameEn: string | null;
  /** Null for a make-up session. */
  number: number | null;
  startsAt: Date;
  homework: BoardHomework[];
};

/**
 * Every homework item of the teacher's, grouped by the session it was given for (newest session
 * first), with one row per learner it went to. The page filters these by answer status.
 */
export async function homeworkBoard(teacherId: string): Promise<BoardSession[]> {
  const items = await db
    .select({
      id: assignments.id,
      type: assignments.type,
      title: assignments.title,
      dueAt: assignments.dueAt,
      sessionId: assignments.sessionId,
      classId: sessions.classId,
      startsAt: sessions.startsAt,
      kind: sessions.kind,
      classNameFa: classes.nameFa,
      classNameEn: classes.nameEn,
    })
    .from(assignments)
    .innerJoin(sessions, eq(sessions.id, assignments.sessionId))
    .innerJoin(classes, eq(classes.id, sessions.classId))
    .where(and(eq(assignments.teacherId, teacherId), isNotNull(assignments.publishedAt)))
    .orderBy(desc(sessions.startsAt), asc(assignments.createdAt));
  if (!items.length) return [];
  const ids = items.map((i) => i.id);
  const classIds = [...new Set(items.map((i) => i.classId))];
  const [people, numbered] = await Promise.all([
    db
      .select({
        assignmentId: assignmentRecipients.assignmentId,
        studentId: students.id,
        fullNameFa: students.fullNameFa,
        fullNameEn: students.fullNameEn,
        submissionId: submissions.id,
        status: submissions.status,
        submittedAt: submissions.submittedAt,
        revision: submissions.revision,
      })
      .from(assignmentRecipients)
      .innerJoin(students, eq(students.id, assignmentRecipients.studentId))
      .leftJoin(
        submissions,
        and(
          eq(submissions.assignmentId, assignmentRecipients.assignmentId),
          eq(submissions.studentId, assignmentRecipients.studentId),
        ),
      )
      .where(inArray(assignmentRecipients.assignmentId, ids))
      .orderBy(asc(students.fullNameFa)),
    db
      .select({ id: sessions.id, classId: sessions.classId })
      .from(sessions)
      .where(and(inArray(sessions.classId, classIds), eq(sessions.kind, "class")))
      .orderBy(asc(sessions.startsAt)),
  ]);

  const out: BoardSession[] = [];
  for (const item of items) {
    let group = out.find((g) => g.sessionId === item.sessionId);
    if (!group) {
      const ofClass = numbered.filter((s) => s.classId === item.classId);
      group = {
        sessionId: item.sessionId,
        classNameFa: item.classNameFa,
        classNameEn: item.classNameEn,
        number:
          item.kind === "class" ? ofClass.findIndex((s) => s.id === item.sessionId) + 1 : null,
        startsAt: item.startsAt,
        homework: [],
      };
      out.push(group);
    }
    group.homework.push({
      id: item.id,
      type: item.type,
      title: item.title,
      learners: people
        .filter((p) => p.assignmentId === item.id)
        .map(({ assignmentId: _, ...p }) => ({
          ...p,
          revision: p.revision ?? 1,
          late: Boolean(p.submittedAt && item.dueAt && p.submittedAt > item.dueAt),
        })),
    });
  }
  return out;
}
