"use server";

import { hasLocale } from "next-intl";
import { refresh } from "next/cache";
import { z } from "zod";
import { routing } from "@/i18n/routing";
import { requireAdmin } from "../auth/current";
import { consumeRateLimit } from "../rate-limit";
import { getClientIp } from "../request";
import {
  addSlot,
  bookingInputSchema,
  bookLevelCheck,
  removeFreeSlot,
  slotInputSchema,
} from "./level-check";
import { joinWaitlist, waitlistInputSchema } from "./waitlist";

const HOUR = 60 * 60;

/** Error keys map to messages under each form's `errors`. */
export type FormState = {
  status: "idle" | "success" | "error";
  /** Form-level error. */
  error?: "rate_limited" | "slot_taken" | "past" | "overlap";
  /** Field name → error key. */
  fieldErrors?: Record<string, string>;
  /** Submitted values, echoed back so React's post-action form reset doesn't wipe them. */
  values?: Record<string, string>;
};

const text = (form: FormData, key: string) => String(form.get(key) ?? "");

/** Bots fill every field; people never see this one. */
const isBot = (form: FormData) => text(form, "website") !== "";

const formLocale = (form: FormData) => {
  const locale = text(form, "locale");
  return hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
};

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const field = String(issue.path[0] ?? "");
    out[field] ??= issue.message;
  }
  return out;
}

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
  return { status: "success" };
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
  await requireAdmin();
  const values = { date: text(form, "date"), time: text(form, "time") };
  const parsed = slotInputSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error.issues), values };
  }
  const result = await addSlot(parsed.data);
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
