import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { students, teacherLearners, teachers } from "@/db/schema";

export type LearnerProfile = {
  fullNameFa: string;
  fullNameEn: string | null;
  phone: string;
  email: string | null;
  since: Date;
  teachers: { nameFa: string; nameEn: string }[];
};

/** What the learner's profile page shows: read-only, because their teachers own these details. */
export async function learnerProfile(userId: string): Promise<LearnerProfile | null> {
  const [student] = await db.select().from(students).where(eq(students.userId, userId));
  if (!student) return null;
  const mine = await db
    .select({ nameFa: teachers.nameFa, nameEn: teachers.nameEn })
    .from(teacherLearners)
    .innerJoin(teachers, eq(teachers.id, teacherLearners.teacherId))
    .where(eq(teacherLearners.studentId, student.id))
    .orderBy(asc(teacherLearners.createdAt));
  return {
    fullNameFa: student.fullNameFa,
    fullNameEn: student.fullNameEn,
    phone: student.phone,
    email: student.email,
    since: student.createdAt,
    teachers: mine,
  };
}
