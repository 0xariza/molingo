import { eq } from "drizzle-orm";
import { db } from "@/db";
import { teachers } from "@/db/schema";
import { fromTehranTime } from "@/lib/format";
import { addDays } from "@/lib/schedule";
import { sessionsBetween, type DaySession } from "../classes/sessions";
import { LEVEL_CHECK_MINUTES } from "../funnel/constants";
import { slotsBetween, type WeekSlot } from "../funnel/level-check";

export type WeekLevelCheck = WeekSlot & { endsAt: Date };

export type WeekSchedule = {
  /** The Saturday that starts the week ("YYYY-MM-DD", Tehran). */
  start: string;
  sessions: DaySession[];
  /** Level-check times Mona opened: open (`lead` null) or booked. */
  levelChecks: WeekLevelCheck[];
  /** Soft limits, in minutes. */
  limits: { day: number; week: number };
};

/** Everything on Mona's calendar for the Sat–Fri week starting on `start`. */
export async function weekSchedule(
  teacherId: string,
  start: string,
  now = new Date(),
): Promise<WeekSchedule> {
  const from = fromTehranTime(start, "00:00");
  const to = fromTehranTime(addDays(start, 7), "00:00");
  const [sessions, slots, [teacher]] = await Promise.all([
    sessionsBetween(teacherId, from, to, now),
    slotsBetween(from, to),
    db
      .select({ day: teachers.dailyHourLimit, week: teachers.weeklyHourLimit })
      .from(teachers)
      .where(eq(teachers.id, teacherId)),
  ]);
  return {
    start,
    sessions,
    levelChecks: slots.map((s) => ({
      ...s,
      endsAt: new Date(s.startsAt.getTime() + LEVEL_CHECK_MINUTES * 60_000),
    })),
    limits: { day: (teacher?.day ?? 6) * 60, week: (teacher?.week ?? 29) * 60 },
  };
}
