import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { classSlots, enrollments, sessions, students } from "@/db/schema";
import { fromTehranTime } from "@/lib/format";
import { createUser, resetDb } from "@/test/factories";
import {
  archiveClass,
  createClass,
  endEnrollment,
  enroll,
  listClasses,
  listFormingGroups,
  moveLearner,
  newClassSchema,
  nextCourseDefaults,
  teacherIdFor,
  updateClass,
} from "../classes";
import { classStats, learnerClasses } from "../stats";

beforeEach(() => resetDb(db));

// Thu 22 Mehr 1405 is 2026-10-14; the class starts on Sat 2 Aban (2026-10-24).
const now = fromTehranTime("2026-10-14", "12:00");

const form = (overrides: Record<string, unknown> = {}) =>
  newClassSchema.parse({
    nameFa: "صبح A2",
    nameEn: "Morning A2",
    level: "A2",
    type: "group",
    capacity: "3",
    sessionCount: "4",
    sessionMinutes: "90",
    slots: JSON.stringify([
      { weekday: 0, time: "۰۸:۰۰" },
      { weekday: 2, time: "08:00" },
    ]),
    startsOn: "2026-10-24",
    price: "۶٬۵۰۰٬۰۰۰",
    description: "",
    isPublic: true,
    studentIds: "[]",
    ...overrides,
  });

async function teacher() {
  const mona = await createUser(db, { phone: "+989120000001", role: "admin" });
  return teacherIdFor(mona.id);
}

let n = 0;
async function learner(status: "lead" | "active" | "paused" | "left" = "active") {
  const [row] = await db
    .insert(students)
    .values({
      fullNameFa: `زبان‌آموز ${++n}`,
      phone: `+98912100${String(n).padStart(4, "0")}`,
      status,
    })
    .returning({ id: students.id });
  return row.id;
}

async function created(overrides: Record<string, unknown> = {}, teacherId?: string) {
  const r = await createClass(form(overrides), teacherId ?? (await teacher()), now);
  if (!r.ok) throw new Error(`class not created: ${r.error}`);
  return r.id;
}

describe("newClassSchema", () => {
  it("reads Persian digits, separators and times; a private class has one seat", () => {
    const v = form({ type: "private", capacity: "3", isPublic: true });
    expect(v.price).toBe(6_500_000);
    expect(v.capacity).toBe(1);
    expect(v.isPublic).toBe(false);
    expect(v.slots).toEqual([
      { weekday: 0, minutes: 480 },
      { weekday: 2, minutes: 480 },
    ]);
  });

  it.each([
    [{ slots: "[]" }, "slots", "slots"],
    // An empty form reports the missing days too, not only the start date.
    [{ slots: "[]", startsOn: "" }, "slots", "slots"],
    [{ slots: JSON.stringify([{ weekday: 0, time: "25:00" }]) }, "slots", "slotTime"],
    [
      {
        slots: JSON.stringify([
          { weekday: 0, time: "08:00" },
          { weekday: 0, time: "10:00" },
        ]),
      },
      "slots",
      "slotDay",
    ],
    [{ startsOn: "2026-10-25" }, "startsOn", "startsOnDay"],
    [{ capacity: "1" }, "capacity", "capacity"],
    [{ sessionMinutes: "50" }, "sessionMinutes", "sessionMinutes"],
    [{ price: "0" }, "price", "price"],
  ])("refuses %o", (overrides, field, key) => {
    const r = newClassSchema.safeParse({
      nameFa: "صبح A2",
      nameEn: "Morning A2",
      level: "A2",
      type: "group",
      capacity: "3",
      sessionCount: "4",
      sessionMinutes: "90",
      slots: JSON.stringify([{ weekday: 0, time: "08:00" }]),
      startsOn: "2026-10-24",
      price: "100",
      description: "",
      isPublic: false,
      studentIds: "[]",
      ...overrides,
    });
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => [i.path[0], i.message])).toContainEqual([field, key]);
  });
});

describe("createClass", () => {
  it("creates the slots and exactly the planned sessions", async () => {
    const id = await created();
    expect(await db.select().from(classSlots).where(eq(classSlots.classId, id))).toHaveLength(2);
    const rows = await db
      .select()
      .from(sessions)
      .where(eq(sessions.classId, id))
      .orderBy(sessions.startsAt);
    expect(rows.map((s) => s.startsAt)).toEqual([
      fromTehranTime("2026-10-24", "08:00"),
      fromTehranTime("2026-10-26", "08:00"),
      fromTehranTime("2026-10-31", "08:00"),
      fromTehranTime("2026-11-02", "08:00"),
    ]);
    expect(rows[0].endsAt).toEqual(fromTehranTime("2026-10-24", "09:30"));
  });

  it("refuses a start in the past", async () => {
    const r = await createClass(form({ startsOn: "2026-10-10" }), await teacher(), now);
    expect(r).toEqual({ ok: false, error: "past" });
  });

  it("refuses times that overlap another class and names it", async () => {
    const t = await teacher();
    await created({}, t);
    const r = await createClass(
      form({
        nameFa: "مکالمه B1",
        nameEn: "Speaking B1",
        slots: JSON.stringify([{ weekday: 2, time: "09:00" }]),
        startsOn: "2026-10-26",
      }),
      t,
      now,
    );
    expect(r).toMatchObject({ ok: false, error: "clash", clash: { nameEn: "Morning A2" } });
  });

  it("the database itself refuses overlapping sessions", async () => {
    const t = await teacher();
    const id = await created({}, t);
    await expect(
      db.insert(sessions).values({
        teacherId: t,
        classId: id,
        startsAt: fromTehranTime("2026-10-24", "09:00"),
        endsAt: fromTehranTime("2026-10-24", "10:00"),
      }),
    ).rejects.toMatchObject({ cause: { code: "23P01" } });
  });

  it("seats the chosen learners and makes leads active", async () => {
    const lead = await learner("lead");
    const id = await created({ studentIds: JSON.stringify([lead]) });
    const [row] = await db.select().from(students).where(eq(students.id, lead));
    expect(row.status).toBe("active");
    expect(row.startedAt).not.toBeNull();
    expect((await learnerClasses(lead)).map((c) => c.classId)).toEqual([id]);
  });

  it("creates nothing when a chosen learner has left", async () => {
    const gone = await learner("left");
    const r = await createClass(form({ studentIds: JSON.stringify([gone]) }), await teacher(), now);
    expect(r).toEqual({ ok: false, error: "learner_unavailable" });
    expect(await listClasses()).toEqual([]);
  });
});

describe("seats", () => {
  it("never seats more than the capacity, even when two requests race for the last seat", async () => {
    const id = await created({ capacity: "2" });
    await enroll(id, await learner());
    const [a, b] = [await learner(), await learner()];
    const results = await Promise.all([enroll(id, a), enroll(id, b)]);
    expect(results.map((r) => r.ok).sort()).toEqual([false, true]);
    expect(results).toContainEqual({ ok: false, error: "full" });
    const active = await db
      .select()
      .from(enrollments)
      .where(and(eq(enrollments.classId, id), eq(enrollments.status, "active")));
    expect(active).toHaveLength(2);
  });

  it("refuses the same learner twice and anyone who left", async () => {
    const id = await created();
    const s = await learner();
    await enroll(id, s);
    expect(await enroll(id, s)).toEqual({ ok: false, error: "already" });
    expect(await enroll(id, await learner("left"))).toEqual({ ok: false, error: "unavailable" });
  });

  it("ending a place frees the seat and keeps the history", async () => {
    const id = await created({ capacity: "2" });
    const [a, b, c] = [await learner(), await learner(), await learner()];
    await enroll(id, a);
    await enroll(id, b);
    expect(await enroll(id, c)).toEqual({ ok: false, error: "full" });
    expect(await endEnrollment(id, a)).toBe(true);
    expect(await enroll(id, c)).toEqual({ ok: true });
    expect((await learnerClasses(a))[0].status).toBe("ended");
  });

  it("moves a learner only when the other class has a seat", async () => {
    const t = await teacher();
    const from = await created({}, t);
    const to = await created(
      {
        nameFa: "مکالمه B1",
        nameEn: "Speaking B1",
        type: "private",
        slots: JSON.stringify([{ weekday: 4, time: "18:00" }]),
        startsOn: "2026-10-28",
      },
      t,
    );
    const [a, b] = [await learner(), await learner()];
    await enroll(from, a);
    await enroll(from, b);
    expect(await moveLearner(from, to, a)).toEqual({ ok: true });
    expect(await moveLearner(from, to, b)).toEqual({ ok: false, error: "full" });
    // A refused move leaves the learner where they were.
    expect((await learnerClasses(b)).map((c) => [c.nameEn, c.status])).toEqual([
      ["Morning A2", "active"],
    ]);
  });
});

describe("editing and archiving", () => {
  it("won't drop the capacity below the learners already in", async () => {
    const id = await created();
    await enroll(id, await learner());
    await enroll(id, await learner());
    const edit = {
      nameFa: "صبح A2",
      nameEn: null,
      level: "A2" as const,
      price: 100,
      description: null,
      isPublic: false,
    };
    expect(await updateClass(id, { ...edit, capacity: 1 })).toEqual({
      ok: false,
      error: "capacity",
    });
    expect(await updateClass(id, { ...edit, capacity: 4 })).toEqual({ ok: true });
  });

  it("archives only an empty class", async () => {
    const id = await created();
    const s = await learner();
    await enroll(id, s);
    expect(await archiveClass(id)).toBe(false);
    await endEnrollment(id, s);
    expect(await archiveClass(id)).toBe(true);
    expect((await listClasses())[0].state).toBe("archived");
  });
});

describe("listing and stats", () => {
  it("shows seats, state and the learners without a running class", async () => {
    const t = await teacher();
    const id = await created({ capacity: "2" }, t);
    const [a, b] = [await learner(), await learner()];
    await enroll(id, a);
    await enroll(id, b);
    const idle = await learner();
    await learner("lead");

    const cards = await listClasses();
    expect(cards[0]).toMatchObject({ taken: 2, capacity: 2, state: "full" });
    expect(cards[0].slots).toEqual([
      { weekday: 0, minutes: 480 },
      { weekday: 2, minutes: 480 },
    ]);
    const stats = await classStats(cards);
    expect(stats).toMatchObject({
      running: { total: 1, group: 1, private: 0 },
      seats: { taken: 2, total: 2 },
      full: 1,
      byLevel: { A2: 2, B1: 0 },
    });
    expect(stats.withoutClass.map((s) => s.id)).toEqual([idle]);
  });
});

describe("listFormingGroups", () => {
  it("shows public groups with free seats only", async () => {
    const t = await teacher();
    const open = await created({ capacity: "2" }, t);
    const full = await created(
      {
        nameFa: "پر",
        capacity: "2",
        slots: JSON.stringify([{ weekday: 1, time: "10:00" }]),
        startsOn: "2026-10-25",
      },
      t,
    );
    await created(
      {
        nameFa: "پنهان",
        isPublic: false,
        slots: JSON.stringify([{ weekday: 3, time: "10:00" }]),
        startsOn: "2026-10-27",
      },
      t,
    );
    await enroll(open, await learner());
    await enroll(full, await learner());
    await enroll(full, await learner());
    expect(await listFormingGroups()).toEqual([
      expect.objectContaining({ id: open, free: 1, startsOn: "2026-10-24", level: "A2" }),
    ]);
  });
});

describe("nextCourseDefaults", () => {
  it("is only offered once every session is over, one level up, after the last session", async () => {
    const id = await created();
    const s = await learner();
    await enroll(id, s);
    expect(await nextCourseDefaults(id, "2026-10-14")).toBeNull();

    await db.update(sessions).set({ status: "held" }).where(eq(sessions.classId, id));
    const next = await nextCourseDefaults(id, "2026-10-14");
    expect(next).toMatchObject({
      level: "B1",
      startsOn: "2026-11-07", // the Saturday after the last session (Mon 2026-11-02)
      studentIds: [s],
      price: 6_500_000,
      sessionCount: 4,
      slots: [
        { weekday: 0, minutes: 480 },
        { weekday: 2, minutes: 480 },
      ],
    });
  });

  it("continuing hands the learners on and ends their old places", async () => {
    const t = await teacher();
    const id = await created({}, t);
    const s = await learner();
    await enroll(id, s);
    await db.update(sessions).set({ status: "held" }).where(eq(sessions.classId, id));
    const next = await nextCourseDefaults(id, "2026-10-14");
    const r = await createClass(
      form({
        nameFa: "صبح B1",
        nameEn: "Morning B1",
        level: "B1",
        startsOn: next!.startsOn,
        studentIds: JSON.stringify(next!.studentIds),
        fromClassId: id,
      }),
      t,
      now,
    );
    expect(r.ok).toBe(true);
    expect((await learnerClasses(s)).map((c) => [c.nameEn, c.status])).toEqual([
      ["Morning B1", "active"],
      ["Morning A2", "ended"],
    ]);
  });
});
