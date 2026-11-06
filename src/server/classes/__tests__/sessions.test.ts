import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { attendance, levelCheckSlots, sessions, students, teacherLearners } from "@/db/schema";
import { fromTehranTime } from "@/lib/format";
import { createTeacher, createUser, resetDb } from "@/test/factories";
import { createClass, enroll, newClassSchema } from "../classes";
import {
  addMakeup,
  awaitingConfirmation,
  sessionsToday,
  cancelSession,
  getClassDetail,
  makeupSchema,
  markHeld,
  moveSchema,
  moveSession,
  sessionPhase,
  sessionsBetween,
} from "../sessions";

/** Mona's teacher id. */
let tid: string;
beforeEach(async () => {
  await resetDb(db);
  const mona = await createUser(db, { phone: "+989120000001", role: "teacher" });
  tid = (await createTeacher(db, mona.id)).id;
});

const now = fromTehranTime("2026-10-14", "12:00");
const at = (date: string, time: string) => fromTehranTime(date, time);

let n = 0;
async function learner() {
  const [row] = await db
    .insert(students)
    .values({
      fullNameFa: `زبان‌آموز ${++n}`,
      phone: `+98912200${String(n).padStart(4, "0")}`,
    })
    .returning({ id: students.id });
  await db.insert(teacherLearners).values({ teacherId: tid, studentId: row.id, status: "active" });
  return row.id;
}

/** A Sat/Mon 08:00 group class from Sat 2026-10-24, 4 × 90 min, with two learners. */
async function setup() {
  const teacherId = tid;
  const r = await createClass(
    newClassSchema.parse({
      nameFa: "صبح A2",
      nameEn: "Morning A2",
      level: "A2",
      type: "group",
      capacity: "3",
      sessionCount: "4",
      sessionMinutes: "90",
      slots: JSON.stringify([
        { weekday: 0, time: "08:00" },
        { weekday: 2, time: "08:00" },
      ]),
      startsOn: "2026-10-24",
      price: "6500000",
      description: "",
      isPublic: false,
      studentIds: "[]",
    }),
    teacherId,
    now,
  );
  if (!r.ok) throw new Error(r.error);
  const [a, b] = [await learner(), await learner()];
  await enroll(tid, r.id, a);
  await enroll(tid, r.id, b);
  const list = await db
    .select()
    .from(sessions)
    .where(eq(sessions.classId, r.id))
    .orderBy(sessions.startsAt);
  return { classId: r.id, teacherId, a, b, first: list[0], second: list[1] };
}

describe("sessionPhase", () => {
  const s = {
    status: "scheduled" as const,
    startsAt: at("2026-10-24", "08:00"),
    endsAt: at("2026-10-24", "09:30"),
  };
  it("follows the clock until Mona confirms", () => {
    expect(sessionPhase(s, at("2026-10-24", "07:59"))).toBe("upcoming");
    expect(sessionPhase(s, at("2026-10-24", "08:00"))).toBe("live");
    expect(sessionPhase(s, at("2026-10-24", "09:30"))).toBe("ended");
    expect(sessionPhase({ ...s, status: "held" }, now)).toBe("held");
  });
});

describe("cancelSession", () => {
  it("cancels only sessions that haven't started", async () => {
    const { first } = await setup();
    expect(await cancelSession(tid, first.id, null, at("2026-10-24", "08:10"))).toBe(false);
    expect(await cancelSession(tid, first.id, "I'm unwell", now)).toBe(true);
    const [row] = await db.select().from(sessions).where(eq(sessions.id, first.id));
    expect(row).toMatchObject({ status: "cancelled", cancelReason: "I'm unwell" });
  });
});

describe("markHeld", () => {
  it("records everyone's attendance once the session has started", async () => {
    const { first, a, b } = await setup();
    expect(await markHeld(tid, first.id, { [a]: "present", [b]: "absent" }, now)).toEqual({
      ok: false,
      error: "not_ready",
    });
    const during = at("2026-10-24", "09:00");
    expect(await markHeld(tid, first.id, { [a]: "present" }, during)).toEqual({
      ok: false,
      error: "attendance",
    });
    expect(await markHeld(tid, first.id, { [a]: "present", [b]: "excused" }, during)).toEqual({
      ok: true,
    });
    expect(await markHeld(tid, first.id, { [a]: "present", [b]: "excused" }, during)).toEqual({
      ok: false,
      error: "not_ready",
    });
    const marks = await db.select().from(attendance).where(eq(attendance.sessionId, first.id));
    expect(marks.map((m) => m.status).sort()).toEqual(["excused", "present"]);
  });

  it("shows counts on the class page", async () => {
    const { classId, first, a, b } = await setup();
    await markHeld(tid, first.id, { [a]: "present", [b]: "absent" }, at("2026-10-24", "10:00"));
    const detail = await getClassDetail(tid, classId, at("2026-10-24", "10:00"));
    expect(detail!.sessions[0]).toMatchObject({
      number: 1,
      phase: "held",
      counts: { present: 1, absent: 1, excused: 0 },
    });
    expect(detail!.sessions[1].phase).toBe("upcoming");
    expect(detail!.state).toBe("open");
  });
});

describe("addMakeup", () => {
  const input = (o: Record<string, unknown>) =>
    makeupSchema.parse({ date: "2026-11-05", time: "۱۷:۰۰", minutes: "90", ...o });

  it("adds a make-up for chosen learners, replacing a cancelled session", async () => {
    const { classId, first, a } = await setup();
    await cancelSession(tid, first.id, null, now);
    const r = await addMakeup(
      tid,
      input({ classId, studentIds: [a], replacesSessionId: first.id }),
      now,
    );
    expect(r.ok).toBe(true);
    const detail = await getClassDetail(tid, classId, now);
    const makeup = detail!.sessions.find((s) => s.kind === "makeup")!;
    expect(makeup).toMatchObject({ number: null, replacesNumber: 1, phase: "upcoming" });
    // Regular sessions keep their numbers around the make-up.
    expect(detail!.sessions.filter((s) => s.kind === "class").map((s) => s.number)).toEqual([
      1, 2, 3, 4,
    ]);
    expect(makeup.participants!.map((p) => p.id)).toEqual([a]);
    // …and only once.
    expect(
      await addMakeup(
        tid,
        input({ classId, studentIds: [a], replacesSessionId: first.id, date: "2026-11-06" }),
        now,
      ),
    ).toEqual({ ok: false, error: "replaces" });
  });

  it("refuses clashes, past times, outsiders and sessions that weren't cancelled", async () => {
    const { classId, second, a } = await setup();
    expect(
      await addMakeup(
        tid,
        input({ classId, studentIds: [a], date: "2026-10-26", time: "09:00" }),
        now,
      ),
    ).toMatchObject({
      ok: false,
      error: "clash",
      clash: { nameEn: "Morning A2" },
    });
    expect(
      await addMakeup(tid, input({ classId, studentIds: [a], date: "2026-10-01" }), now),
    ).toEqual({
      ok: false,
      error: "past",
    });
    expect(await addMakeup(tid, input({ classId, studentIds: [await learner()] }), now)).toEqual({
      ok: false,
      error: "learners",
    });
    expect(
      await addMakeup(tid, input({ classId, studentIds: [a], replacesSessionId: second.id }), now),
    ).toEqual({
      ok: false,
      error: "replaces",
    });
  });

  it("a held make-up only takes attendance for its own learners", async () => {
    const { classId, a } = await setup();
    const r = await addMakeup(tid, input({ classId, studentIds: [a] }), now);
    const id = r.ok ? r.id : "";
    expect(await markHeld(tid, id, { [a]: "present" }, at("2026-11-05", "18:00"))).toEqual({
      ok: true,
    });
  });
});

describe("dashboard queries", () => {
  it("lists today's sessions with their phase and learners, and the ones waiting to be marked", async () => {
    const { teacherId, first, second, a, b } = await setup();
    // Sat 2026-10-24 at 09:00: session 1 (08:00–09:30) is on.
    const during = at("2026-10-24", "09:00");
    const today = await sessionsToday(teacherId, during);
    expect(today.map((s) => [s.id, s.phase, s.people])).toEqual([[first.id, "live", 2]]);
    expect(await awaitingConfirmation(teacherId, during)).toEqual([]);

    // Two days later both sessions are over; the first was marked, the second wasn't.
    await markHeld(tid, first.id, { [a]: "present", [b]: "present" }, during);
    const later = at("2026-10-26", "12:00");
    expect((await awaitingConfirmation(teacherId, later)).map((s) => s.id)).toEqual([second.id]);
  });
});

describe("moveSession", () => {
  const move = (sessionId: string, date: string, time: string, when = now) =>
    moveSession(tid, moveSchema.parse({ sessionId, date, time }), when);
  const row = async (id: string) =>
    (await db.select().from(sessions).where(eq(sessions.id, id)))[0];

  it("moves an upcoming session, keeps its length and remembers where it was", async () => {
    const { first } = await setup();
    expect(await move(first.id, "2026-10-25", "10:00")).toEqual({ ok: true });
    expect(await row(first.id)).toMatchObject({
      startsAt: at("2026-10-25", "10:00"),
      endsAt: at("2026-10-25", "11:30"),
      movedFrom: at("2026-10-24", "08:00"),
    });
    // Moving it again keeps the first time; moving it back clears the mark.
    await move(first.id, "2026-10-25", "12:00");
    expect((await row(first.id)).movedFrom).toEqual(at("2026-10-24", "08:00"));
    await move(first.id, "2026-10-24", "08:00");
    expect((await row(first.id)).movedFrom).toBeNull();
  });

  it("can shift a session over its own old time", async () => {
    const { first } = await setup();
    expect(await move(first.id, "2026-10-24", "08:30")).toEqual({ ok: true });
  });

  it("refuses clashes with sessions and level-check times", async () => {
    const { first } = await setup();
    expect(await move(first.id, "2026-10-26", "07:00")).toMatchObject({
      ok: false,
      error: "clash",
      clash: { kind: "class", nameEn: "Morning A2" },
    });
    await db
      .insert(levelCheckSlots)
      .values({ teacherId: tid, startsAt: at("2026-10-25", "18:00") });
    expect(await move(first.id, "2026-10-25", "16:45")).toEqual({
      ok: false,
      error: "clash",
      clash: { kind: "levelCheck", startsAt: at("2026-10-25", "18:00") },
    });
  });

  it("refuses past times, and sessions that started or were cancelled", async () => {
    const { first, second } = await setup();
    expect(await move(first.id, "2026-10-13", "10:00")).toEqual({ ok: false, error: "past" });
    expect(await move(first.id, "2026-10-25", "10:00", at("2026-10-24", "08:05"))).toEqual({
      ok: false,
      error: "not_movable",
    });
    await cancelSession(tid, second.id, null, now);
    expect(await move(second.id, "2026-10-27", "10:00")).toEqual({
      ok: false,
      error: "not_movable",
    });
  });

  it("shows up moved on the calendar", async () => {
    const { first, teacherId } = await setup();
    await move(first.id, "2026-10-25", "10:00");
    const week = await sessionsBetween(
      teacherId,
      at("2026-10-24", "00:00"),
      at("2026-10-31", "00:00"),
      now,
    );
    expect(week.map((s) => [s.startsAt, s.movedFrom, s.people])).toEqual([
      [at("2026-10-25", "10:00"), at("2026-10-24", "08:00"), 2],
      [at("2026-10-26", "08:00"), null, 2],
    ]);
  });
});

describe("another teacher", () => {
  it("can't see, cancel, move, confirm or add to Mona's sessions", async () => {
    const { classId, first, a, b } = await setup();
    const ali = await createUser(db, { phone: "+989120000009", role: "teacher" });
    const other = (await createTeacher(db, ali.id)).id;
    expect(await getClassDetail(other, classId, now)).toBeNull();
    expect(await cancelSession(other, first.id, null, now)).toBe(false);
    expect(
      await moveSession(
        other,
        moveSchema.parse({ sessionId: first.id, date: "2026-10-27", time: "10:00" }),
        now,
      ),
    ).toEqual({ ok: false, error: "not_movable" });
    expect(
      await markHeld(
        other,
        first.id,
        { [a]: "present", [b]: "present" },
        at("2026-10-24", "09:00"),
      ),
    ).toEqual({ ok: false, error: "not_ready" });
    expect(
      await addMakeup(
        other,
        makeupSchema.parse({
          classId,
          date: "2026-10-27",
          time: "10:00",
          minutes: "60",
          studentIds: [a],
        }),
        now,
      ),
    ).toEqual({ ok: false, error: "not_found" });
  });
});
