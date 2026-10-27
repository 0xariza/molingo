import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { levelCheckSlots, teachers } from "@/db/schema";
import { fromTehranTime } from "@/lib/format";
import { createLevelCheckSlot, createTeacher, createUser, resetDb } from "@/test/factories";
import { createClass, newClassSchema } from "../../classes/classes";
import { weekSchedule } from "../week";

beforeEach(() => resetDb(db));

const at = (date: string, time: string) => fromTehranTime(date, time);
const now = at("2026-10-14", "12:00");

describe("weekSchedule", () => {
  it("gathers the Sat–Fri week's sessions and level-check times, with Mona's limits", async () => {
    const mona = await createUser(db, { phone: "+989120000001", role: "teacher" });
    const teacherId = (await createTeacher(db, mona.id)).id;
    // Sat and Fri: both inside the week of 17–23 Oct; the next Saturday falls outside.
    await createClass(
      newClassSchema.parse({
        nameFa: "خصوصی",
        nameEn: "",
        level: "B1",
        type: "private",
        capacity: "1",
        sessionCount: "3",
        sessionMinutes: "60",
        slots: JSON.stringify([
          { weekday: 0, time: "23:30" },
          { weekday: 6, time: "09:00" },
        ]),
        startsOn: "2026-10-17",
        price: "900000",
        description: "",
        isPublic: false,
        studentIds: "[]",
      }),
      teacherId,
      now,
    );
    const open = await createLevelCheckSlot(db, teacherId, at("2026-10-20", "18:00"));
    await createLevelCheckSlot(db, teacherId, at("2026-10-23", "17:00"), {
      name: "Nika",
      phone: "+989125551234",
    });
    await db.insert(levelCheckSlots).values({ teacherId, startsAt: at("2026-10-24", "10:00") });

    const week = await weekSchedule(teacherId, "2026-10-17", now);
    expect(week.sessions.map((s) => s.startsAt)).toEqual([
      at("2026-10-17", "23:30"),
      at("2026-10-23", "09:00"),
    ]);
    expect(week.levelChecks).toMatchObject([
      { id: open.id, lead: null, endsAt: at("2026-10-20", "18:20") },
      { lead: { name: "Nika", source: "online" } },
    ]);
    expect(week.limits).toEqual({ day: 360, week: 29 * 60 });

    await db.update(teachers).set({ weeklyHourLimit: 20 });
    expect((await weekSchedule(teacherId, "2026-10-17", now)).limits.week).toBe(1200);
  });
});
