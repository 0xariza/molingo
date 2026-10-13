import { and, asc, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { leads, levelCheckSlots, levelGuessEnum } from "@/db/schema";
import { locales } from "@/i18n/routing";
import { fromTehranTime } from "@/lib/format";
import { normalizePhone } from "@/lib/phone";

/** Every free level check is a 20-minute call with Mona. */
export const LEVEL_CHECK_MINUTES = 20;
/** Visitors can book up to two weeks ahead. */
export const BOOKING_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Field-level error keys map to messages under `Landing.booking.errors`. */
export const bookingInputSchema = z.object({
  slotId: z.uuid("slot"),
  name: z.string().trim().min(2, "name").max(80, "name"),
  phone: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const phone = normalizePhone(v);
      if (!phone) ctx.addIssue({ code: "custom", message: "phone" });
      return phone ?? "";
    }),
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

/** Mona enters Tehran wall-clock time; error keys map to `Admin.levelChecks.errors`. */
export const slotInputSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date"),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "time"),
  })
  .transform(({ date, time }) => fromTehranTime(date, time));

export type AddSlotResult = { ok: true } | { ok: false; error: "past" | "overlap" };

/** Opens a new time. Refuses past times and any time that overlaps an existing slot. */
export async function addSlot(startsAt: Date, now = new Date()): Promise<AddSlotResult> {
  if (startsAt <= now) return { ok: false, error: "past" };
  const length = LEVEL_CHECK_MINUTES * 60 * 1000;
  const [clash] = await db
    .select({ id: levelCheckSlots.id })
    .from(levelCheckSlots)
    .where(
      and(
        gt(levelCheckSlots.startsAt, new Date(startsAt.getTime() - length)),
        lt(levelCheckSlots.startsAt, new Date(startsAt.getTime() + length)),
      ),
    )
    .limit(1);
  if (clash) return { ok: false, error: "overlap" };
  const inserted = await db
    .insert(levelCheckSlots)
    .values({ startsAt })
    .onConflictDoNothing({ target: levelCheckSlots.startsAt })
    .returning({ id: levelCheckSlots.id });
  return inserted.length ? { ok: true } : { ok: false, error: "overlap" };
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
