import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { leads, levelCheckSlots } from "@/db/schema";
import { createTeacher, createUser, resetDb } from "@/test/factories";
import {
  bookingInputSchema,
  bookLevelCheck,
  cancelBooking,
  newJoinCode,
  saveLeadNotes,
} from "../../funnel/level-check";
import { teacherLevelCheck, visitorLevelCheck } from "../level-check";

let teacherId: string;
beforeEach(async () => {
  await resetDb(db);
  const mona = await createUser(db, { phone: "+989120000001", role: "teacher" });
  teacherId = (await createTeacher(db, mona.id)).id;
});

const MINUTE = 60_000;
const startsAt = new Date(Date.now() + 3 * 60 * MINUTE);
const plus = (m: number) => new Date(startsAt.getTime() + m * MINUTE);

/** A booked 20-minute level check three hours ahead, and the visitor's link code. */
async function booked() {
  const [slot] = await db.insert(levelCheckSlots).values({ teacherId, startsAt }).returning();
  const r = await bookLevelCheck(
    bookingInputSchema.parse({
      slotId: slot.id,
      name: "Sara Ahmadi",
      phone: "09121234567",
      locale: "fa",
    }),
  );
  if (!r.ok) throw new Error("booking failed");
  return { slot, code: r.code };
}

describe("visitorLevelCheck", () => {
  it("opens 10 minutes before and closes when the 20 minutes are up", async () => {
    const { slot, code } = await booked();
    expect(await visitorLevelCheck(code, plus(-11))).toMatchObject({
      ok: false,
      error: "tooEarly",
      opensAt: plus(-10),
    });
    expect(await visitorLevelCheck(code, plus(-10))).toMatchObject({
      ok: true,
      room: {
        slotId: slot.id,
        room: `l_${slot.id}`,
        role: "student",
        name: "Sara",
        closesAt: plus(20),
      },
    });
    expect(await visitorLevelCheck(code, plus(21))).toEqual({ ok: false, error: "ended" });
  });

  it("gives the visitor one fixed identity, so a second device replaces the first", async () => {
    const { code } = await booked();
    const a = await visitorLevelCheck(code, startsAt);
    const b = await visitorLevelCheck(code, startsAt);
    expect(a.ok && b.ok && a.room.visitorIdentity === b.room.visitorIdentity).toBe(true);
  });

  it("stops the old link when Mona makes a new one", async () => {
    const { slot, code } = await booked();
    const fresh = await newJoinCode(teacherId, slot.id);
    expect(fresh).toBeTruthy();
    expect(await visitorLevelCheck(code, startsAt)).toEqual({ ok: false, error: "notFound" });
    expect((await visitorLevelCheck(fresh!, startsAt)).ok).toBe(true);
  });

  it("stops the link when the booking is cancelled, and gives no link for a free time", async () => {
    const { slot, code } = await booked();
    await cancelBooking(teacherId, slot.id);
    expect(await visitorLevelCheck(code, startsAt)).toEqual({ ok: false, error: "notFound" });
    expect(await newJoinCode(teacherId, slot.id)).toBeNull();
    expect(await teacherLevelCheck(teacherId, slot.id, startsAt)).toEqual({
      ok: false,
      error: "notFound",
    });
  });

  it("refuses malformed codes without a lookup", async () => {
    expect(await visitorLevelCheck("../../etc")).toEqual({ ok: false, error: "notFound" });
  });
});

describe("teacherLevelCheck", () => {
  it("lets Mona in an hour early and half an hour after the end", async () => {
    const { slot } = await booked();
    expect((await teacherLevelCheck(teacherId, slot.id, plus(-61))).ok).toBe(false);
    expect(await teacherLevelCheck(teacherId, slot.id, plus(-60))).toMatchObject({
      ok: true,
      room: { role: "teacher" },
    });
    expect((await teacherLevelCheck(teacherId, slot.id, plus(50))).ok).toBe(true);
    expect(await teacherLevelCheck(teacherId, slot.id, plus(51))).toEqual({
      ok: false,
      error: "ended",
    });
  });
});

describe("visitor details for Mona", () => {
  it("carries the visitor's booking and Mona's saved notes", async () => {
    const { slot } = await booked();
    const [lead] = await db.select().from(leads);
    expect(await saveLeadNotes(teacherId, { leadId: lead.id, notes: "B1, wants IELTS" })).toBe(
      true,
    );
    expect(await teacherLevelCheck(teacherId, slot.id, startsAt)).toMatchObject({
      visitor: {
        leadId: lead.id,
        name: "Sara Ahmadi",
        phone: "+989121234567",
        source: "online",
        notes: "B1, wants IELTS",
      },
    });
  });

  it("stops saving notes once the person is a learner", async () => {
    await booked();
    const [lead] = await db.update(leads).set({ status: "converted" }).returning();
    expect(await saveLeadNotes(teacherId, { leadId: lead.id, notes: "late" })).toBe(false);
  });
});

describe("another teacher", () => {
  it("can't enter the room, make a new link, cancel it or write notes", async () => {
    const { slot } = await booked();
    const [lead] = await db.select().from(leads);
    const ali = await createUser(db, { phone: "+989120000009", role: "teacher" });
    const other = (await createTeacher(db, ali.id)).id;
    expect(await teacherLevelCheck(other, slot.id, startsAt)).toEqual({
      ok: false,
      error: "notFound",
    });
    expect(await newJoinCode(other, slot.id)).toBeNull();
    expect(await cancelBooking(other, slot.id)).toBe(false);
    expect(await saveLeadNotes(other, { leadId: lead.id, notes: "x" })).toBe(false);
  });
});
