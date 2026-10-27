"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "../auth/current";
import { fieldErrors, formLocale, text } from "../forms";
import { consumeRateLimit } from "../rate-limit";
import { getClientIp } from "../request";
import { teacherIdFor } from "../classes/classes";
import {
  addSlot,
  assignLeadSchema,
  assignNewPersonSchema,
  assignSlot,
  bookingInputSchema,
  bookLevelCheck,
  cancelBooking,
  leadNotesSchema,
  newJoinCode,
  saveLeadNotes,
  removeFreeSlot,
  slotInputSchema,
} from "./level-check";
import { joinWaitlist, waitlistInputSchema } from "./waitlist";

const HOUR = 60 * 60;

/** Unprefixed, so it opens in the language the visitor last chose on the site. */
function levelCheckUrl(code: string) {
  const base = process.env.APP_URL;
  if (!base) throw new Error("APP_URL is not set");
  return `${base}/l/${code}`;
}

/** Error keys map to messages under each form's `errors`. */
export type FormState = {
  status: "idle" | "success" | "error";
  /** Form-level error. */
  error?: "rate_limited" | "slot_taken" | "past" | "overlap" | "lead";
  /** Field name → error key. */
  fieldErrors?: Record<string, string>;
  /** Submitted values, echoed back so React's post-action form reset doesn't wipe them. */
  values?: Record<string, string>;
  /** A booked visitor's level-check room link (`/l/<code>`), shown once. */
  link?: string;
};

/** Bots fill every field; people never see this one. */
const isBot = (form: FormData) => text(form, "website") !== "";

export async function bookLevelCheckAction(_: FormState, form: FormData): Promise<FormState> {
  const values = Object.fromEntries(
    ["slotId", "name", "phone", "levelGuess"].map((k) => [k, text(form, k)]),
  );
  if (isBot(form)) return { status: "success" };

  const parsed = bookingInputSchema.safeParse({
    ...values,
    levelGuess: values.levelGuess || undefined,
    locale: formLocale(form),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error.issues), values };
  }

  const limits = await Promise.all([
    consumeRateLimit(`lead:ip:${await getClientIp()}`, 5, HOUR),
    consumeRateLimit(`lead:phone:${parsed.data.phone}`, 3, 24 * HOUR),
  ]);
  if (limits.some((l) => !l.allowed)) return { status: "error", error: "rate_limited", values };

  const result = await bookLevelCheck(parsed.data);
  if (!result.ok) {
    // Someone else took it: reload the calendar so the visitor sees what's still free.
    refresh();
    return { status: "error", error: result.error, values: { ...values, slotId: "" } };
  }
  return { status: "success", link: levelCheckUrl(result.code) };
}

export async function joinWaitlistAction(_: FormState, form: FormData): Promise<FormState> {
  const values = { email: text(form, "email") };
  if (isBot(form)) return { status: "success" };

  const parsed = waitlistInputSchema.safeParse({ email: values.email, locale: formLocale(form) });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error.issues), values };
  }

  const limit = await consumeRateLimit(`waitlist:ip:${await getClientIp()}`, 10, HOUR);
  if (!limit.allowed) return { status: "error", error: "rate_limited", values };

  await joinWaitlist(parsed.data);
  return { status: "success" };
}

export async function addSlotAction(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const values = { date: text(form, "date"), time: text(form, "time") };
  const parsed = slotInputSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error.issues), values };
  }
  const result = await addSlot(parsed.data, await teacherIdFor(admin.id));
  if (!result.ok) return { status: "error", error: result.error, values };
  refresh();
  // Keep the chosen day so Mona can add several times on it in a row.
  return { status: "success", values: { date: values.date, time: "" } };
}

export async function removeSlotAction(form: FormData): Promise<void> {
  await requireAdmin();
  const slotId = z.uuid().safeParse(text(form, "slotId"));
  if (!slotId.success) return;
  await removeFreeSlot(slotId.data);
  refresh();
}

/** Mona gives an open time to someone on her list (`leadId`) or to a new person (name, phone). */
export async function assignSlotAction(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const values = Object.fromEntries(
    ["slotId", "leadId", "name", "phone"].map((k) => [k, text(form, k)]),
  );
  const parsed = values.leadId
    ? assignLeadSchema.safeParse({ slotId: values.slotId, leadId: values.leadId })
    : assignNewPersonSchema.safeParse({
        slotId: values.slotId,
        name: values.name,
        phone: values.phone,
        locale: formLocale(form),
      });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error.issues), values };
  }
  const result = await assignSlot(parsed.data);
  refresh();
  return result.ok ? { status: "success" } : { status: "error", error: result.error, values };
}

/** A new room link for a booked level check; the visitor's earlier link stops working. */
export async function newLevelCheckLinkAction(
  slotId: string,
): Promise<{ ok: true; url: string } | { ok: false }> {
  await requireAdmin();
  const id = z.uuid().safeParse(slotId);
  const code = id.success ? await newJoinCode(id.data) : null;
  return code ? { ok: true, url: levelCheckUrl(code) } : { ok: false };
}

/** Saves Mona's notes on the visitor during (or after) a level check. */
export async function saveLeadNotesAction(leadId: string, notes: string): Promise<boolean> {
  await requireAdmin();
  const parsed = leadNotesSchema.safeParse({ leadId, notes });
  return parsed.success && (await saveLeadNotes(parsed.data));
}

export async function cancelBookingAction(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const slotId = z.uuid().safeParse(text(form, "slotId"));
  if (!slotId.success) return { status: "error", error: "slot_taken" };
  const ok = await cancelBooking(slotId.data);
  refresh();
  return ok ? { status: "success" } : { status: "error", error: "slot_taken" };
}
