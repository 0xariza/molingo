import { and, asc, desc, eq, gt, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { leads, levelCheckSlots, levelGuessEnum } from "@/db/schema";
import { locales } from "@/i18n/routing";
import { fromTehranTime } from "@/lib/format";
import { findClash } from "../classes/clash";
import { phoneField } from "../forms";
import { BOOKING_DAYS, LEVEL_CHECK_MINUTES } from "./constants";

export { BOOKING_DAYS, LEVEL_CHECK_MINUTES };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Field-level error keys map to messages under `Landing.booking.errors`. */
export const bookingInputSchema = z.object({
  slotId: z.uuid("slot"),
  name: z.string().trim().min(2, "name").max(80, "name"),
  phone: phoneField,
  levelGuess: z.enum(levelGuessEnum.enumValues).default("unsure"),
  locale: z.enum(locales),
});

export type BookingInput = z.output<typeof bookingInputSchema>;

export type OpenSlot = { id: string; startsAt: Date };

/** Slots a visitor can still book: free, in the future, within the booking window. */
export async function listOpenSlots(now = new Date()): Promise<OpenSlot[]> {
  return db
    .select({ id: levelCheckSlots.id, startsAt: levelCheckSlots.startsAt })
    .from(levelCheckSlots)
    .where(
      and(
        isNull(levelCheckSlots.leadId),
        gt(levelCheckSlots.startsAt, now),
        lt(levelCheckSlots.startsAt, new Date(now.getTime() + BOOKING_DAYS * DAY_MS)),
      ),
    )
    .orderBy(asc(levelCheckSlots.startsAt));
}

class SlotTaken extends Error {}

/**
 * Saves the lead and takes the slot in one transaction. The conditional update means two
 * visitors racing for one slot can't both get it: the second sees no free row and nothing is saved.
 */
export async function bookLevelCheck(
  input: BookingInput,
): Promise<{ ok: true; startsAt: Date } | { ok: false; error: "slot_taken" }> {
  const { slotId, ...lead } = input;
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(leads)
        .values({ ...lead, status: "scheduled" })
        .returning({ id: leads.id });
      const [slot] = await tx
        .update(levelCheckSlots)
        .set({ leadId: row.id })
        .where(
          and(
            eq(levelCheckSlots.id, slotId),
            isNull(levelCheckSlots.leadId),
            gt(levelCheckSlots.startsAt, sql`now()`),
          ),
        )
        .returning({ startsAt: levelCheckSlots.startsAt });
      if (!slot) throw new SlotTaken();
      return { ok: true as const, startsAt: slot.startsAt };
    });
  } catch (e) {
    if (e instanceof SlotTaken) return { ok: false, error: "slot_taken" };
    throw e;
  }
}

/** Mona enters Tehran wall-clock time; error keys map to `Admin.schedule.errors`. */
export const slotInputSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date"),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "time"),
  })
  .transform(({ date, time }) => fromTehranTime(date, time));

export type AddSlotResult = { ok: true } | { ok: false; error: "past" | "overlap" };

/**
 * Opens a new time. Refuses past times and any time that overlaps one of Mona's sessions or
 * another level-check time.
 */
export async function addSlot(
  startsAt: Date,
  teacherId: string,
  now = new Date(),
): Promise<AddSlotResult> {
  if (startsAt <= now) return { ok: false, error: "past" };
  const endsAt = new Date(startsAt.getTime() + LEVEL_CHECK_MINUTES * 60_000);
  if (await findClash(teacherId, [{ startsAt, endsAt }])) return { ok: false, error: "overlap" };
  const inserted = await db
    .insert(levelCheckSlots)
    .values({ startsAt })
    .onConflictDoNothing({ target: levelCheckSlots.startsAt })
    .returning({ id: levelCheckSlots.id });
  return inserted.length ? { ok: true } : { ok: false, error: "overlap" };
}

/** Who Mona gives an open time to: someone already on her list, or a new person she names. */
/** Mona gives an open time to someone already on her list… */
export const assignLeadSchema = z.object({ slotId: z.uuid(), leadId: z.uuid() });

/** …or to someone new. (Separate schemas, so a bad field reports its own error key.) */
export const assignNewPersonSchema = z.object({
  slotId: z.uuid(),
  name: z.string().trim().min(2, "name").max(80, "name"),
  phone: phoneField,
  locale: z.enum(locales),
});

export type AssignInput =
  z.output<typeof assignLeadSchema> | z.output<typeof assignNewPersonSchema>;

class AssignFailed extends Error {
  constructor(readonly reason: "slot_taken" | "lead") {
    super(reason);
  }
}

/**
 * Mona books an open time for someone herself (a "manual" booking). The lead must not already
 * hold a time; the slot must still be open and ahead.
 */
export async function assignSlot(
  input: AssignInput,
  now = new Date(),
): Promise<{ ok: true } | { ok: false; error: "slot_taken" | "lead" }> {
  try {
    return await db.transaction(async (tx) => {
      let leadId: string;
      if ("leadId" in input) {
        const [lead] = await tx
          .update(leads)
          // Mona booked this time, whoever first put them on the list.
          .set({ status: "scheduled", source: "manual" })
          .where(
            and(
              eq(leads.id, input.leadId),
              inArray(leads.status, ["new", "contacted"]),
              sql`not exists (select 1 from ${levelCheckSlots} s where s.lead_id = ${input.leadId})`,
            ),
          )
          .returning({ id: leads.id });
        if (!lead) throw new AssignFailed("lead");
        leadId = lead.id;
      } else {
        const [lead] = await tx
          .insert(leads)
          .values({
            name: input.name,
            phone: input.phone,
            locale: input.locale,
            status: "scheduled",
            source: "manual",
          })
          .returning({ id: leads.id });
        leadId = lead.id;
      }
      const [slot] = await tx
        .update(levelCheckSlots)
        .set({ leadId })
        .where(
          and(
            eq(levelCheckSlots.id, input.slotId),
            isNull(levelCheckSlots.leadId),
            gt(levelCheckSlots.startsAt, now),
          ),
        )
        .returning({ id: levelCheckSlots.id });
      if (!slot) throw new AssignFailed("slot_taken");
      return { ok: true as const };
    });
  } catch (e) {
    if (e instanceof AssignFailed) return { ok: false, error: e.reason };
    throw e;
  }
}

/**
 * Cancels a booking that hasn't happened yet. The time opens again for someone else and the
 * person goes back to Mona's list to be offered a new one.
 */
export async function cancelBooking(slotId: string, now = new Date()): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [slot] = await tx
      .select({ leadId: levelCheckSlots.leadId })
      .from(levelCheckSlots)
      .where(and(eq(levelCheckSlots.id, slotId), gt(levelCheckSlots.startsAt, now)))
      .for("update");
    if (!slot?.leadId) return false;
    await tx.update(levelCheckSlots).set({ leadId: null }).where(eq(levelCheckSlots.id, slotId));
    await tx
      .update(leads)
      .set({ status: "new" })
      .where(and(eq(leads.id, slot.leadId), eq(leads.status, "scheduled")));
    return true;
  });
}

export type WaitingLead = {
  id: string;
  name: string;
  phone: string;
  levelGuess: (typeof levelGuessEnum.enumValues)[number];
  status: "new" | "contacted";
};

/** People Mona can give a time to: on her list, not converted or lost, holding no time. */
export async function listWaitingLeads(): Promise<WaitingLead[]> {
  const rows = await db
    .select({
      id: leads.id,
      name: leads.name,
      phone: leads.phone,
      levelGuess: leads.levelGuess,
      status: leads.status,
    })
    .from(leads)
    .leftJoin(levelCheckSlots, eq(levelCheckSlots.leadId, leads.id))
    .where(and(inArray(leads.status, ["new", "contacted"]), isNull(levelCheckSlots.id)))
    .orderBy(desc(leads.createdAt));
  return rows.map((r) => ({ ...r, status: r.status as WaitingLead["status"] }));
}

/** Removes a time Mona no longer offers. Booked slots stay (the visitor is expecting the call). */
export async function removeFreeSlot(id: string): Promise<boolean> {
  const deleted = await db
    .delete(levelCheckSlots)
    .where(and(eq(levelCheckSlots.id, id), isNull(levelCheckSlots.leadId)))
    .returning({ id: levelCheckSlots.id });
  return deleted.length > 0;
}

export type UpcomingSlot = {
  id: string;
  startsAt: Date;
  lead: {
    name: string;
    phone: string;
    levelGuess: (typeof levelGuessEnum.enumValues)[number];
  } | null;
};

/** Mona's view: every upcoming slot, with who booked it. */
export async function listUpcomingSlots(now = new Date()): Promise<UpcomingSlot[]> {
  const rows = await db
    .select({
      id: levelCheckSlots.id,
      startsAt: levelCheckSlots.startsAt,
      name: leads.name,
      phone: leads.phone,
      levelGuess: leads.levelGuess,
    })
    .from(levelCheckSlots)
    .leftJoin(leads, eq(leads.id, levelCheckSlots.leadId))
    .where(gt(levelCheckSlots.startsAt, now))
    .orderBy(asc(levelCheckSlots.startsAt));
  return rows.map(({ id, startsAt, name, phone, levelGuess }) => ({
    id,
    startsAt,
    lead: name && phone && levelGuess ? { name, phone, levelGuess } : null,
  }));
}

export type WeekSlot = {
  id: string;
  startsAt: Date;
  lead: {
    name: string;
    phone: string;
    levelGuess: (typeof levelGuessEnum.enumValues)[number];
    source: "online" | "manual";
  } | null;
};

/** Level-check times starting in [from, to), open or booked, for the week calendar. */
export async function slotsBetween(from: Date, to: Date): Promise<WeekSlot[]> {
  const rows = await db
    .select({
      id: levelCheckSlots.id,
      startsAt: levelCheckSlots.startsAt,
      name: leads.name,
      phone: leads.phone,
      levelGuess: leads.levelGuess,
      source: leads.source,
    })
    .from(levelCheckSlots)
    .leftJoin(leads, eq(leads.id, levelCheckSlots.leadId))
    .where(and(gte(levelCheckSlots.startsAt, from), lt(levelCheckSlots.startsAt, to)))
    .orderBy(asc(levelCheckSlots.startsAt));
  return rows.map(({ id, startsAt, name, phone, levelGuess, source }) => ({
    id,
    startsAt,
    lead: name && phone && levelGuess && source ? { name, phone, levelGuess, source } : null,
  }));
}
