import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { classes, classSlots, enrollments, sessions, students, teachers } from "@/db/schema";
import { parseClock, type WeeklySlot } from "@/lib/schedule";
import type { CefrLevel } from "../classes/classes";

export type LearnerClass = {
  id: string;
  nameFa: string;
  nameEn: string | null;
  level: CefrLevel;
  type: "private" | "group";
  teacherNameFa: string;
  teacherNameEn: string;
  slots: WeeklySlot[];
  sessionCount: number;
  held: number;
  /** The next scheduled session; null once the class has none left. */
  nextStartsAt: Date | null;
  finished: boolean;
};

/**
 * A learner's classes: those they hold a place in, and finished ones they took part in. A class
 * they were moved out of, while it still runs, is not theirs any more.
 */
export async function learnerClasses(userId: string, now = new Date()): Promise<LearnerClass[]> {
  const places = await db
    .select({
      id: classes.id,
      nameFa: classes.nameFa,
      nameEn: classes.nameEn,
      level: classes.level,
      type: classes.type,
      sessionCount: classes.sessionCount,
      teacherNameFa: teachers.nameFa,
      teacherNameEn: teachers.nameEn,
      status: enrollments.status,
    })
    .from(enrollments)
    .innerJoin(students, and(eq(students.id, enrollments.studentId), eq(students.userId, userId)))
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .innerJoin(teachers, eq(teachers.id, classes.teacherId))
    .orderBy(asc(classes.createdAt));
  const ids = [...new Set(places.map((p) => p.id))];
  if (!ids.length) return [];
  const [slotRows, sessionRows] = await Promise.all([
    db
      .select()
      .from(classSlots)
      .where(inArray(classSlots.classId, ids))
      .orderBy(asc(classSlots.weekday)),
    db
      .select({
        classId: sessions.classId,
        kind: sessions.kind,
        status: sessions.status,
        startsAt: sessions.startsAt,
      })
      .from(sessions)
      .where(inArray(sessions.classId, ids))
      .orderBy(asc(sessions.startsAt)),
  ]);

  const seen = new Set<string>();
  return places.flatMap(({ status, ...c }) => {
    const mine = sessionRows.filter((s) => s.classId === c.id);
    const finished = !mine.some((s) => s.status === "scheduled");
    if (seen.has(c.id) || (status === "ended" && !finished)) return [];
    seen.add(c.id);
    return [
      {
        ...c,
        slots: slotRows
          .filter((s) => s.classId === c.id)
          .map((s) => ({
            weekday: s.weekday as WeeklySlot["weekday"],
            minutes: parseClock(s.startTime.slice(0, 5))!,
          })),
        held: mine.filter((s) => s.kind === "class" && s.status === "held").length,
        nextStartsAt:
          mine.find((s) => s.status === "scheduled" && s.startsAt > now)?.startsAt ?? null,
        finished,
      },
    ];
  });
}
