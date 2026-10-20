import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { leads, students, users } from "@/db/schema";
import { fromTehranTime } from "@/lib/format";
import { resetDb } from "@/test/factories";
import { learnerStats } from "../stats";

beforeEach(() => resetDb(db));

// Wed 22 Mehr 1405 (Tehran). The window is Ordibehesht–Mehr 1405.
const now = fromTehranTime("2026-10-14", "12:00");
let n = 0;
const learner = (status: "lead" | "active" | "paused" | "left", startedAt: Date | null) =>
  db.insert(students).values({
    fullNameFa: `زبان‌آموز ${++n}`,
    phone: `+98912000${String(n).padStart(4, "0")}`,
    status,
    startedAt,
  });

describe("learnerStats", () => {
  it("buckets new learners by Jalali month and counts statuses", async () => {
    await learner("active", fromTehranTime("2026-09-23", "00:30")); // 1 Mehr
    await learner("active", fromTehranTime("2026-10-10", "09:00")); // Mehr
    await learner("paused", fromTehranTime("2026-09-22", "23:30")); // 31 Shahrivar
    await learner("left", fromTehranTime("2026-04-21", "10:00")); // 1 Ordibehesht
    await learner("active", fromTehranTime("2026-04-20", "10:00")); // Farvardin: outside
    await learner("lead", null);

    const s = await learnerStats(now);
    expect(s.perMonth.map((m) => [m.key, m.count])).toEqual([
      ["1405-02", 1],
      ["1405-03", 0],
      ["1405-04", 0],
      ["1405-05", 0],
      ["1405-06", 1],
      ["1405-07", 2],
    ]);
    expect(s.byStatus).toEqual({ lead: 1, active: 3, paused: 1, left: 1 });
  });

  it("counts bookings since the window began and how many converted", async () => {
    const since = fromTehranTime("2026-04-21", "00:00");
    expect((await learnerStats(now)).bookings.since).toEqual(since);
    await db.insert(leads).values([
      { name: "A", phone: "+989121110000", locale: "fa", status: "converted" },
      { name: "B", phone: "+989121110001", locale: "fa", status: "scheduled" },
      {
        name: "Old",
        phone: "+989121110002",
        locale: "fa",
        status: "converted",
        createdAt: new Date(since.getTime() - 1000),
      },
    ]);
    expect((await learnerStats(now)).bookings).toMatchObject({ total: 2, converted: 1 });
  });

  it("counts logins whose activation link hasn't been used", async () => {
    const [pending] = await db
      .insert(users)
      .values({ phone: "+989121111111", role: "student", displayName: "P" })
      .returning();
    const [off] = await db
      .insert(users)
      .values({ phone: "+989121111112", role: "student", displayName: "O", isActive: false })
      .returning();
    await db.insert(students).values([
      { fullNameFa: "P", phone: pending.phone, userId: pending.id },
      { fullNameFa: "O", phone: off.phone, userId: off.id },
    ]);
    expect((await learnerStats(now)).pendingLogins).toBe(1);
  });
});
