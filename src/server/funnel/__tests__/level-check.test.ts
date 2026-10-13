import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { leads, levelCheckSlots } from "@/db/schema";
import { resetDb } from "@/test/factories";
import {
  addSlot,
  bookingInputSchema,
  bookLevelCheck,
  listOpenSlots,
  listUpcomingSlots,
  removeFreeSlot,
  slotInputSchema,
} from "../level-check";

beforeEach(() => resetDb(db));

const HOUR = 60 * 60 * 1000;
const inHours = (h: number) => new Date(Date.now() + h * HOUR);

async function slotAt(startsAt: Date) {
  const [row] = await db.insert(levelCheckSlots).values({ startsAt }).returning();
  return row;
}

const booking = (slotId: string, phone = "۰۹۱۲ ۱۲۳ ۴۵۶۷") =>
  bookingInputSchema.parse({ slotId, name: "Sara Ahmadi", phone, locale: "fa" });

describe("bookingInputSchema", () => {
  it("normalizes the phone and defaults the level", () => {
    const r = booking("0195f0a2-5d3e-7c1a-9b2e-3f4a5b6c7d8e");
    expect(r.phone).toBe("+989121234567");
    expect(r.levelGuess).toBe("unsure");
  });

  it("reports each invalid field with its key", () => {
    const r = bookingInputSchema.safeParse({
      slotId: "",
      name: "S",
      phone: "12",
      levelGuess: "expert",
      locale: "fa",
    });
    expect(r.success).toBe(false);
    const fields = r.error!.issues.map((i) => [i.path[0], i.message]);
    expect(fields).toEqual(
      expect.arrayContaining([
        ["slotId", "slot"],
        ["name", "name"],
        ["phone", "phone"],
      ]),
    );
    expect(fields.map(([f]) => f)).toContain("levelGuess");
  });
});

describe("listOpenSlots", () => {
  it("offers only free, future slots inside the two-week window, earliest first", async () => {
    const later = await slotAt(inHours(48));
    const soon = await slotAt(inHours(2));
    await slotAt(inHours(-1));
    await slotAt(inHours(15 * 24));
    const booked = await slotAt(inHours(5));
    await bookLevelCheck(booking(booked.id));

    expect((await listOpenSlots()).map((s) => s.id)).toEqual([soon.id, later.id]);
  });
});

describe("bookLevelCheck", () => {
  it("saves a scheduled lead and takes the slot", async () => {
    const slot = await slotAt(inHours(3));
    const r = await bookLevelCheck(booking(slot.id));
    expect(r).toEqual({ ok: true, startsAt: slot.startsAt });

    const [lead] = await db.select().from(leads);
    expect(lead).toMatchObject({
      name: "Sara Ahmadi",
      phone: "+989121234567",
      levelGuess: "unsure",
      locale: "fa",
      status: "scheduled",
    });
    const [taken] = await db.select().from(levelCheckSlots);
    expect(taken.leadId).toBe(lead.id);
  });

  it("refuses a slot that is already taken and saves nothing", async () => {
    const slot = await slotAt(inHours(3));
    await bookLevelCheck(booking(slot.id));
    expect(await bookLevelCheck(booking(slot.id, "09125550000"))).toEqual({
      ok: false,
      error: "slot_taken",
    });
    expect(await db.select().from(leads)).toHaveLength(1);
  });

  it("gives a slot to only one of two simultaneous visitors", async () => {
    const slot = await slotAt(inHours(3));
    const results = await Promise.all([
      bookLevelCheck(booking(slot.id, "09121111111")),
      bookLevelCheck(booking(slot.id, "09122222222")),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await db.select().from(leads)).toHaveLength(1);
  });

  it("refuses past and unknown slots", async () => {
    const past = await slotAt(inHours(-1));
    expect((await bookLevelCheck(booking(past.id))).ok).toBe(false);
    expect((await bookLevelCheck(booking("0195f0a2-5d3e-7c1a-9b2e-3f4a5b6c7d8e"))).ok).toBe(false);
    expect(await db.select().from(leads)).toHaveLength(0);
  });
});

describe("slotInputSchema", () => {
  it("reads Mona's input as Tehran time", () => {
    expect(slotInputSchema.parse({ date: "2026-10-13", time: "18:00" }).toISOString()).toBe(
      "2026-10-13T14:30:00.000Z",
    );
  });
  it("rejects malformed dates and times", () => {
    const r = slotInputSchema.safeParse({ date: "13/10/2026", time: "25:00" });
    expect(r.error!.issues.map((i) => i.message).sort()).toEqual(["date", "time"]);
  });
});

describe("addSlot", () => {
  it("opens a future slot", async () => {
    expect(await addSlot(inHours(5))).toEqual({ ok: true });
    expect(await db.select().from(levelCheckSlots)).toHaveLength(1);
  });

  it("refuses past times", async () => {
    expect(await addSlot(inHours(-1))).toEqual({ ok: false, error: "past" });
  });

  it("refuses a time that overlaps another slot, but allows back-to-back slots", async () => {
    const start = inHours(5);
    await addSlot(start);
    const tenMinutes = 10 * 60 * 1000;
    const twentyMinutes = 2 * tenMinutes;
    expect(await addSlot(start)).toEqual({ ok: false, error: "overlap" });
    expect(await addSlot(new Date(start.getTime() + tenMinutes))).toEqual({
      ok: false,
      error: "overlap",
    });
    expect(await addSlot(new Date(start.getTime() + twentyMinutes))).toEqual({ ok: true });
  });
});

describe("removeFreeSlot", () => {
  it("removes free slots but keeps booked ones", async () => {
    const free = await slotAt(inHours(3));
    const booked = await slotAt(inHours(4));
    await bookLevelCheck(booking(booked.id));

    expect(await removeFreeSlot(free.id)).toBe(true);
    expect(await removeFreeSlot(booked.id)).toBe(false);
    expect((await db.select().from(levelCheckSlots)).map((s) => s.id)).toEqual([booked.id]);
  });
});

describe("listUpcomingSlots", () => {
  it("lists future slots with who booked them", async () => {
    await slotAt(inHours(-2));
    const free = await slotAt(inHours(2));
    const booked = await slotAt(inHours(3));
    await bookLevelCheck(booking(booked.id));

    expect(await listUpcomingSlots()).toEqual([
      { id: free.id, startsAt: free.startsAt, lead: null },
      {
        id: booked.id,
        startsAt: booked.startsAt,
        lead: { name: "Sara Ahmadi", phone: "+989121234567", levelGuess: "unsure" },
      },
    ]);
  });
});
