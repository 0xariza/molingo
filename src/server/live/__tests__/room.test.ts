import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { enrollments, sessionParticipants, sessions } from "@/db/schema";
import { fromTehranTime } from "@/lib/format";
import { createClass, createLearner, createTeacher, createUser, resetDb } from "@/test/factories";
import type { SessionUser } from "../../auth/sessions";
import { firstName, recordRemoval, roomFor, roomWindow, windowError } from "../room";

beforeEach(() => resetDb(db));

const at = (time: string) => fromTehranTime("2026-10-24", time);
const asUser = (u: { id: string; role: SessionUser["role"]; displayName: string }) =>
  ({ id: u.id, role: u.role, displayName: u.displayName }) as SessionUser;

/** A Saturday 08:00–09:30 class with one learner (Sara Ahmadi) who has a login. */
async function setup() {
  const mona = await createUser(db, { phone: "+989120000001", role: "admin", displayName: "Mona" });
  const teacher = await createTeacher(db, mona.id);
  const saraUser = await createUser(db, { phone: "+989120000002" });
  const sara = await createLearner(db, { userId: saraUser.id, fullNameFa: "سارا احمدی" });
  const cls = await createClass(db, {
    teacherId: teacher.id,
    slots: [{ weekday: 0, time: "08:00" }],
    startsOn: "2026-10-24",
    sessionCount: 2,
    studentIds: [sara.id],
  });
  return {
    mona: asUser(mona),
    sara: asUser(saraUser),
    saraId: sara.id,
    cls,
    first: cls.sessions[0],
  };
}

describe("windowError", () => {
  const s = { status: "scheduled" as const, startsAt: at("08:00"), endsAt: at("09:30") };

  it("opens for learners 15 minutes early and closes at the end", () => {
    expect(windowError("student", s, at("07:44"))).toBe("tooEarly");
    expect(windowError("student", s, at("07:45"))).toBeNull();
    expect(windowError("student", s, at("09:30"))).toBeNull();
    expect(windowError("student", s, at("09:31"))).toBe("ended");
  });

  it("lets Mona in an hour early and half an hour late", () => {
    expect(windowError("teacher", s, at("06:59"))).toBe("tooEarly");
    expect(windowError("teacher", s, at("07:00"))).toBeNull();
    expect(windowError("teacher", s, at("10:00"))).toBeNull();
    expect(windowError("teacher", s, at("10:01"))).toBe("ended");
    expect(roomWindow("teacher", s).closesAt).toEqual(at("10:00"));
  });

  it("keeps cancelled and held sessions closed", () => {
    expect(windowError("teacher", { ...s, status: "cancelled" }, at("08:10"))).toBe("closed");
    expect(windowError("student", { ...s, status: "held" }, at("08:10"))).toBe("closed");
  });
});

describe("firstName", () => {
  it("keeps the first word only", () => {
    expect(firstName("  سارا احمدی ")).toBe("سارا");
    expect(firstName("Ali")).toBe("Ali");
  });
});

describe("roomFor", () => {
  it("lets an enrolled learner in during the window, under their first name", async () => {
    const { sara, first } = await setup();
    const r = await roomFor(sara, first.id, at("08:05"));
    expect(r).toMatchObject({
      ok: true,
      room: { role: "student", name: "سارا", room: `s_${first.id}`, closesAt: at("09:30") },
    });
    expect(await roomFor(sara, first.id, at("07:30"))).toEqual({
      ok: false,
      error: "tooEarly",
      opensAt: at("07:45"),
    });
  });

  it("lets Mona into any session with her own name", async () => {
    const { mona, first } = await setup();
    expect(await roomFor(mona, first.id, at("07:10"))).toMatchObject({
      ok: true,
      room: { role: "teacher", name: "Mona", capacity: 3 },
    });
  });

  it("keeps out learners without a place, and those whose place ended", async () => {
    const { sara, saraId, first } = await setup();
    const otherUser = await createUser(db, { phone: "+989120000003" });
    await createLearner(db, { userId: otherUser.id });
    expect(await roomFor(asUser(otherUser), first.id, at("08:05"))).toEqual({
      ok: false,
      error: "notFound",
    });

    await db.update(enrollments).set({ status: "ended" }).where(eq(enrollments.studentId, saraId));
    expect(await roomFor(sara, first.id, at("08:05"))).toEqual({ ok: false, error: "notFound" });
  });

  it("opens make-up sessions to the invited learners only", async () => {
    const { sara, saraId, cls, first } = await setup();
    const [makeup] = await db
      .insert(sessions)
      .values({
        teacherId: first.teacherId,
        classId: cls.id,
        kind: "makeup",
        startsAt: fromTehranTime("2026-10-25", "08:00"),
        endsAt: fromTehranTime("2026-10-25", "09:00"),
      })
      .returning();
    const during = fromTehranTime("2026-10-25", "08:10");
    expect(await roomFor(sara, makeup.id, during)).toEqual({ ok: false, error: "notFound" });
    await db.insert(sessionParticipants).values({ sessionId: makeup.id, studentId: saraId });
    expect(await roomFor(sara, makeup.id, during)).toMatchObject({ ok: true });
  });

  it("refuses a learner Mona removed, for that session only", async () => {
    const { sara, first, cls } = await setup();
    await recordRemoval(first.id, sara.id);
    await recordRemoval(first.id, sara.id);
    expect(await roomFor(sara, first.id, at("08:05"))).toEqual({ ok: false, error: "removed" });

    const second = cls.sessions[1];
    const during = new Date(second.startsAt.getTime() + 5 * 60_000);
    expect(await roomFor(sara, second.id, during)).toMatchObject({ ok: true });
  });

  it("treats unknown or malformed ids as not found", async () => {
    const { mona } = await setup();
    expect(await roomFor(mona, "nope", at("08:00"))).toEqual({ ok: false, error: "notFound" });
    expect(await roomFor(mona, crypto.randomUUID(), at("08:00"))).toEqual({
      ok: false,
      error: "notFound",
    });
  });
});
