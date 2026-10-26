import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { levelCheckSlots } from "@/db/schema";
import { resetDb } from "@/test/factories";
import {
  bookingInputSchema,
  bookLevelCheck,
  cancelBooking,
  newJoinCode,
} from "../../funnel/level-check";
import { teacherLevelCheck, visitorLevelCheck } from "../level-check";

beforeEach(() => resetDb(db));

const MINUTE = 60_000;
const startsAt = new Date(Date.now() + 3 * 60 * MINUTE);
const plus = (m: number) => new Date(startsAt.getTime() + m * MINUTE);

/** A booked 20-minute level check three hours ahead, and the visitor's link code. */
async function booked() {
  const [slot] = await db.insert(levelCheckSlots).values({ startsAt }).returning();
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
    const fresh = await newJoinCode(slot.id);
    expect(fresh).toBeTruthy();
    expect(await visitorLevelCheck(code, startsAt)).toEqual({ ok: false, error: "notFound" });
    expect((await visitorLevelCheck(fresh!, startsAt)).ok).toBe(true);
  });

  it("stops the link when the booking is cancelled, and gives no link for a free time", async () => {
    const { slot, code } = await booked();
    await cancelBooking(slot.id);
    expect(await visitorLevelCheck(code, startsAt)).toEqual({ ok: false, error: "notFound" });
    expect(await newJoinCode(slot.id)).toBeNull();
    expect(await teacherLevelCheck(slot.id, startsAt)).toEqual({ ok: false, error: "notFound" });
  });

  it("refuses malformed codes without a lookup", async () => {
    expect(await visitorLevelCheck("../../etc")).toEqual({ ok: false, error: "notFound" });
  });
});

describe("teacherLevelCheck", () => {
  it("lets Mona in an hour early and half an hour after the end", async () => {
    const { slot } = await booked();
    expect((await teacherLevelCheck(slot.id, plus(-61))).ok).toBe(false);
    expect(await teacherLevelCheck(slot.id, plus(-60))).toMatchObject({
      ok: true,
      room: { role: "teacher" },
    });
    expect((await teacherLevelCheck(slot.id, plus(50))).ok).toBe(true);
    expect(await teacherLevelCheck(slot.id, plus(51))).toEqual({ ok: false, error: "ended" });
  });
});
