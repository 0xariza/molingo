import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  assignmentFiles,
  assignmentRecipients,
  assignments,
  files,
  students,
  submissionFiles,
  submissions,
  teacherLearners,
  teachers,
  voiceRecordings,
} from "@/db/schema";

type StoredFile = typeof files.$inferSelect;

/**
 * The file, if this user may read it: the teacher who gave the homework (its files and every
 * answer to it), a learner it was given to (its files), or a learner (their own answer's files).
 */
export async function readableFile(userId: string, fileId: string): Promise<StoredFile | null> {
  const [rec] = await db
    .select({ file: files, studentId: students.id, studentUserId: students.userId })
    .from(voiceRecordings)
    .innerJoin(files, eq(files.id, voiceRecordings.fileId))
    .innerJoin(students, eq(students.id, voiceRecordings.studentId))
    .where(eq(voiceRecordings.fileId, fileId));
  if (rec) {
    if (rec.studentUserId === userId) return rec.file;
    const [mine] = await db
      .select({ id: teachers.id })
      .from(teachers)
      .innerJoin(teacherLearners, eq(teacherLearners.teacherId, teachers.id))
      .where(and(eq(teachers.userId, userId), eq(teacherLearners.studentId, rec.studentId)));
    return mine ? rec.file : null;
  }
  const [onAssignment, onAnswer] = await Promise.all([
    db
      .select({ file: files, teacherUserId: teachers.userId, assignmentId: assignments.id })
      .from(assignmentFiles)
      .innerJoin(files, eq(files.id, assignmentFiles.fileId))
      .innerJoin(assignments, eq(assignments.id, assignmentFiles.assignmentId))
      .innerJoin(teachers, eq(teachers.id, assignments.teacherId))
      .where(eq(assignmentFiles.fileId, fileId)),
    db
      .select({ file: files, teacherUserId: teachers.userId, studentUserId: students.userId })
      .from(submissionFiles)
      .innerJoin(files, eq(files.id, submissionFiles.fileId))
      .innerJoin(submissions, eq(submissions.id, submissionFiles.submissionId))
      .innerJoin(assignments, eq(assignments.id, submissions.assignmentId))
      .innerJoin(teachers, eq(teachers.id, assignments.teacherId))
      .innerJoin(students, eq(students.id, submissions.studentId))
      .where(eq(submissionFiles.fileId, fileId)),
  ]);

  const answer = onAnswer[0];
  if (answer) {
    return answer.teacherUserId === userId || answer.studentUserId === userId ? answer.file : null;
  }
  const given = onAssignment[0];
  if (!given) return null;
  if (given.teacherUserId === userId) return given.file;
  const [recipient] = await db
    .select({ studentId: assignmentRecipients.studentId })
    .from(assignmentRecipients)
    .innerJoin(students, eq(students.id, assignmentRecipients.studentId))
    .where(
      and(eq(assignmentRecipients.assignmentId, given.assignmentId), eq(students.userId, userId)),
    );
  return recipient ? given.file : null;
}
