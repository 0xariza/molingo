import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { classes, leads, levelCheckSlots, sessions } from "@/db/schema";
import { createTeacher, createUser, resetDb } from "@/test/factories";
import {
  addSlot,
  assignLeadSchema,
  assignNewPersonSchema,
  assignSlot,
  bookingInputSchema,
  bookLevelCheck,
  cancelBooking,
  listOpenSlots,
  listUpcomingSlots,
  listWaitingLeads,
  removeFreeSlot,
  slotInputSchema,
  slotsBetween,
} from "../level-check";

let teacherId: string;
beforeEach(async () => {
  await resetDb(db);
  const mona = await createUser(db, { phone: "+989120000001", role: "teacher" });
  teacherId = (await createTeacher(db, mona.id)).id;
});

const HOUR = 60 * 60 * 1000;
const inHours = (h: number) => new Date(Date.now() + h * HOUR);

async function slotAt(startsAt: Date) {
  const [row] = await db.insert(levelCheckSlots).values({ teacherId, startsAt }).returning();
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

    expect((await listOpenSlots(teacherId)).map((s) => s.id)).toEqual([soon.id, later.id]);
  });
});

describe("bookLevelCheck", () => {
  it("saves a scheduled lead and takes the slot", async () => {
    const slot = await slotAt(inHours(3));
    const r = await bookLevelCheck(booking(slot.id));
    expect(r).toEqual({ ok: true, startsAt: slot.startsAt, code: expect.any(String) });

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
    expect(await addSlot(teacherId, inHours(5))).toEqual({ ok: true });
    expect(await db.select().from(levelCheckSlots)).toHaveLength(1);
  });

  it("refuses past times", async () => {
    expect(await addSlot(teacherId, inHours(-1))).toEqual({ ok: false, error: "past" });
  });

  it("refuses a time that overlaps another slot, but allows back-to-back slots", async () => {
    const start = inHours(5);
    await addSlot(teacherId, start);
    const tenMinutes = 10 * 60 * 1000;
    const twentyMinutes = 2 * tenMinutes;
    expect(await addSlot(teacherId, start)).toEqual({ ok: false, error: "overlap" });
    expect(await addSlot(teacherId, new Date(start.getTime() + tenMinutes))).toEqual({
      ok: false,
      error: "overlap",
    });
    expect(await addSlot(teacherId, new Date(start.getTime() + twentyMinutes))).toEqual({
      ok: true,
    });
  });

  it("refuses a time during one of Mona's sessions, unless that session is cancelled", async () => {
    const [cls] = await db
      .insert(classes)
      .values({
        teacherId,
        nameFa: "صبح A2",
        level: "A2",
        type: "private",
        capacity: 1,
        sessionCount: 1,
        sessionMinutes: 60,
        startsOn: "2026-10-24",
        priceToman: 1,
      })
      .returning();
    const [session] = await db
      .insert(sessions)
      .values({ teacherId, classId: cls.id, startsAt: inHours(5), endsAt: inHours(6) })
      .returning();
    expect(await addSlot(teacherId, inHours(5.5))).toEqual({ ok: false, error: "overlap" });
    await db.update(sessions).set({ status: "cancelled" }).where(eq(sessions.id, session.id));
    expect(await addSlot(teacherId, inHours(5.5))).toEqual({ ok: true });
  });
});

describe("removeFreeSlot", () => {
  it("removes free slots but keeps booked ones", async () => {
    const free = await slotAt(inHours(3));
    const booked = await slotAt(inHours(4));
    await bookLevelCheck(booking(booked.id));

    expect(await removeFreeSlot(teacherId, free.id)).toBe(true);
    expect(await removeFreeSlot(teacherId, booked.id)).toBe(false);
    expect((await db.select().from(levelCheckSlots)).map((s) => s.id)).toEqual([booked.id]);
  });
});

describe("listUpcomingSlots", () => {
  it("lists future slots with who booked them", async () => {
    await slotAt(inHours(-2));
    const free = await slotAt(inHours(2));
    const booked = await slotAt(inHours(3));
    await bookLevelCheck(booking(booked.id));

    expect(await listUpcomingSlots(teacherId)).toEqual([
      { id: free.id, startsAt: free.startsAt, lead: null },
      {
        id: booked.id,
        startsAt: booked.startsAt,
        lead: { name: "Sara Ahmadi", phone: "+989121234567", levelGuess: "unsure" },
      },
    ]);
  });
});

describe("assignSlot", () => {
  const assign = (input: Record<string, string>) =>
    assignSlot(
      teacherId,
      "leadId" in input
        ? assignLeadSchema.parse(input)
        : assignNewPersonSchema.parse({ locale: "fa", ...input }),
    );

  it("reports a bad mobile for a new person as a phone error", () => {
    const r = assignNewPersonSchema.safeParse({
      slotId: crypto.randomUUID(),
      name: "Sina",
      phone: "123",
      locale: "en",
    });
    expect(r.error!.issues.map((i) => [i.path[0], i.message])).toEqual([["phone", "phone"]]);
  });

  it("books an open time for a new person as a manual booking", async () => {
    const slot = await slotAt(inHours(3));
    expect(await assign({ slotId: slot.id, name: "سینا مرادی", phone: "09352104417" })).toEqual({
      ok: true,
    });
    const [lead] = await db.select().from(leads);
    expect(lead).toMatchObject({ phone: "+989352104417", source: "manual", status: "scheduled" });
    expect((await slotsBetween(teacherId, inHours(0), inHours(4)))[0].lead).toMatchObject({
      name: "سینا مرادی",
      source: "manual",
    });
  });

  it("books it for someone on the list who holds no time, once", async () => {
    const [lead] = await db
      .insert(leads)
      .values({ teacherId, name: "Mahsa", phone: "+989017723305", locale: "fa" })
      .returning();
    expect(await listWaitingLeads(teacherId)).toMatchObject([{ id: lead.id, status: "new" }]);
    const [a, b] = [await slotAt(inHours(3)), await slotAt(inHours(4))];

    expect(await assign({ slotId: a.id, leadId: lead.id })).toEqual({ ok: true });
    // She first came online, but Mona booked this time.
    expect((await slotsBetween(teacherId, inHours(0), inHours(5)))[0].lead).toMatchObject({
      source: "manual",
    });
    expect(await listWaitingLeads(teacherId)).toEqual([]);
    expect(await assign({ slotId: b.id, leadId: lead.id })).toEqual({ ok: false, error: "lead" });
  });

  it("refuses a time that is taken or past, and saves nothing", async () => {
    const taken = await slotAt(inHours(3));
    await bookLevelCheck(booking(taken.id));
    const past = await slotAt(inHours(-1));
    for (const slot of [taken, past])
      expect(await assign({ slotId: slot.id, name: "Sina", phone: "09352104417" })).toEqual({
        ok: false,
        error: "slot_taken",
      });
    expect(await db.select().from(leads)).toHaveLength(1);
  });
});

describe("cancelBooking", () => {
  it("opens the time again and puts the person back on the list", async () => {
    const slot = await slotAt(inHours(3));
    await bookLevelCheck(booking(slot.id));

    expect(await cancelBooking(teacherId, slot.id)).toBe(true);
    expect((await listOpenSlots(teacherId)).map((s) => s.id)).toEqual([slot.id]);
    expect(await listWaitingLeads(teacherId)).toMatchObject([
      { name: "Sara Ahmadi", status: "new" },
    ]);
    expect(await cancelBooking(teacherId, slot.id)).toBe(false);
  });

  it("leaves past bookings alone", async () => {
    const slot = await slotAt(inHours(3));
    await bookLevelCheck(booking(slot.id));
    expect(await cancelBooking(teacherId, slot.id, inHours(4))).toBe(false);
  });
});
