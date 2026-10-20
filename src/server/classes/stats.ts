import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { classes, enrollments, sessions, students } from "@/db/schema";
import { cefrLevels, type CefrLevel, type ClassCard } from "./classes";

export type ClassStats = {
  running: { total: number; group: number; private: number };
  seats: { taken: number; total: number };
  full: number;
  /** Active learners who aren't in any running class. */
  withoutClass: { id: string; fullNameFa: string; fullNameEn: string | null }[];
  byLevel: Record<CefrLevel, number>;
};

const isRunning = (c: ClassCard) => c.state === "open" || c.state === "full";

export async function classStats(cards: ClassCard[]): Promise<ClassStats> {
  const running = cards.filter(isRunning);
  const withoutClass = await db
    .select({ id: students.id, fullNameFa: students.fullNameFa, fullNameEn: students.fullNameEn })
    .from(students)
    .where(
      and(
        eq(students.status, "active"),
        sql`not exists (
          select 1 from ${enrollments} e join ${classes} c on c.id = e.class_id
          where e.student_id = "students"."id" and e.status = 'active' and c.archived_at is null
            and exists (select 1 from ${sessions} s where s.class_id = c.id and s.status = 'scheduled'))`,
      ),
    );
  const byLevel = Object.fromEntries(cefrLevels.map((l) => [l, 0])) as Record<CefrLevel, number>;
  for (const c of running) byLevel[c.level] += c.taken;
  return {
    running: {
      total: running.length,
      group: running.filter((c) => c.type === "group").length,
      private: running.filter((c) => c.type === "private").length,
    },
    seats: {
      taken: running.reduce((n, c) => n + c.taken, 0),
      total: running.reduce((n, c) => n + c.capacity, 0),
    },
    full: running.filter((c) => c.state === "full").length,
    withoutClass,
    byLevel,
  };
}

/** A learner's classes, current ones first, for their profile. */
export async function learnerClasses(studentId: string) {
  return db
    .select({
      classId: classes.id,
      nameFa: classes.nameFa,
      nameEn: classes.nameEn,
      level: classes.level,
      type: classes.type,
      status: enrollments.status,
      startedAt: enrollments.startedAt,
      endedAt: enrollments.endedAt,
    })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .where(eq(enrollments.studentId, studentId))
    .orderBy(sql`${enrollments.status} = 'active' desc`, desc(enrollments.startedAt));
}
