import { and, count, eq, gte, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { leads, students, users } from "@/db/schema";
import { jalaliMonthKey, recentJalaliMonths } from "@/lib/format";
import { countByStatus, type LearnerStatus } from "./learners";

/** The charts cover the current Jalali month and the five before it. */
export const STATS_MONTHS = 6;

export type LearnerStats = {
  byStatus: Record<LearnerStatus, number>;
  /** New learners (first time active) per Jalali month, oldest first; the last is this month. */
  perMonth: { key: string; date: Date; count: number }[];
  /** Free-session bookings made in the same months, and how many became learners. */
  bookings: { total: number; converted: number; since: Date };
  /** Learners whose activation link hasn't been used yet. */
  pendingLogins: number;
};

export async function learnerStats(now = new Date()): Promise<LearnerStats> {
  const months = recentJalaliMonths(now, STATS_MONTHS);
  const since = months[0].date;

  const [byStatus, started, bookingRows, [pending]] = await Promise.all([
    countByStatus(),
    db
      .select({ startedAt: students.startedAt })
      .from(students)
      .where(and(isNotNull(students.startedAt), gte(students.startedAt, since))),
    db
      .select({ status: leads.status, n: count() })
      .from(leads)
      .where(gte(leads.createdAt, since))
      .groupBy(leads.status),
    db
      .select({ n: count() })
      .from(students)
      .innerJoin(users, eq(users.id, students.userId))
      .where(and(isNull(users.passwordHash), eq(users.isActive, true))),
  ]);

  const perMonth = months.map((m) => ({ ...m, count: 0 }));
  const byKey = new Map(perMonth.map((m) => [m.key, m]));
  for (const { startedAt } of started) {
    const month = byKey.get(jalaliMonthKey(startedAt!));
    if (month) month.count++;
  }

  return {
    byStatus,
    perMonth,
    bookings: {
      total: bookingRows.reduce((sum, r) => sum + r.n, 0),
      converted: bookingRows.find((r) => r.status === "converted")?.n ?? 0,
      since,
    },
    pendingLogins: pending.n,
  };
}
