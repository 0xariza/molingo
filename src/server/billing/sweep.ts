import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, enrollments } from "@/db/schema";
import { recentJalaliMonths, tehranDateKey } from "@/lib/format";
import { addDays } from "@/lib/schedule";
import { draftMonthly } from "./invoices";
import { notifyIssued, notifyReminder } from "./notify";
import { listInvoiceRows } from "./reports";
import { getSettings } from "./settings";

/**
 * What would run on day 1 and every day after, done when the teacher opens Finance: drafts last
 * month's invoices for every private-class learner, then sends due reminders. Safe to repeat: a
 * month is drafted once and each reminder carries a key that is sent once. `shortcut`: nothing
 * runs while the teacher stays away; when a scheduler exists, call this from it.
 */
export async function runBillingSweep(teacherId: string, now = new Date()) {
  const period = recentJalaliMonths(now, 2)[0].key;
  const pairs = await db
    .selectDistinct({ classId: classes.id, studentId: enrollments.studentId })
    .from(classes)
    .innerJoin(enrollments, eq(enrollments.classId, classes.id))
    .where(and(eq(classes.teacherId, teacherId), eq(classes.type, "private")));
  const settings = await getSettings(db, teacherId);
  for (const p of pairs) {
    const id = await draftMonthly(teacherId, p.classId, p.studentId, period, now);
    if (id && settings.autoIssue) await notifyIssued(id);
  }

  const today = tehranDateKey(now);
  for (const i of await listInvoiceRows(teacherId, now)) {
    if (i.status !== "issued" || i.left <= 0 || !i.dueOn) continue;
    if (today === addDays(i.dueOn, -2)) await notifyReminder(i.id, "before", "once");
    if (i.state === "overdue") {
      const week = Math.floor((Date.parse(today) - Date.parse(i.dueOn)) / (7 * 86_400_000));
      await notifyReminder(i.id, "overdue", String(week));
    }
  }
}
