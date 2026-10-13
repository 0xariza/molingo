"use server";

import { hasLocale } from "next-intl";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { getClientIp } from "../request";
import { endSession, getCurrentUser, startSession } from "./current";
import { recordLogin, setPreferredLocale } from "./account";
import { authenticate } from "./login";
import { checkPasswordPolicy } from "./password";
import { homePathFor, safeNextPath } from "./policy";
import { consumeRateLimit } from "../rate-limit";
import { findValidAuthToken, redeemAuthToken } from "./tokens";

/** Error keys map to messages under `Auth.errors`. */
export type AuthErrorKey =
  | "invalid"
  | "rate_limited"
  | "phone"
  | "required"
  | "too_short"
  | "too_common"
  | "mismatch"
  | "link";

export type AuthFormState = { error?: AuthErrorKey; field?: string; phone?: string } | undefined;

const localeOf = (v: FormDataEntryValue | null): Locale =>
  hasLocale(routing.locales, v) ? v : routing.defaultLocale;

const loginSchema = z.object({
  phone: z.string().trim().min(1).max(32),
  password: z.string().min(1).max(200),
  next: z.string().max(300).optional(),
});

export async function loginAction(_: AuthFormState, form: FormData): Promise<AuthFormState> {
  const locale = localeOf(form.get("locale"));
  const parsed = loginSchema.safeParse({
    phone: form.get("phone"),
    password: form.get("password"),
    next: form.get("next") || undefined,
  });
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    return { error: "required", field, phone: String(form.get("phone") ?? "").slice(0, 32) };
  }

  const result = await authenticate(parsed.data.phone, parsed.data.password, await getClientIp());
  // Echo the phone back so React's post-action form reset doesn't wipe it.
  if (!result.ok) return { error: result.error, phone: parsed.data.phone };

  await startSession(result.user.id);
  await recordLogin(result.user.id, locale);
  redirect({ href: safeNextPath(parsed.data.next, result.user.role), locale });
}

const setPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  kind: z.enum(["activation", "reset"]),
  password: z.string().max(200),
  confirm: z.string().max(200),
});

export async function setPasswordAction(_: AuthFormState, form: FormData): Promise<AuthFormState> {
  const locale = localeOf(form.get("locale"));
  const parsed = setPasswordSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "link" };
  const { token, kind, password, confirm } = parsed.data;

  const limit = await consumeRateLimit(`link:ip:${await getClientIp()}`, 20, 15 * 60);
  if (!limit.allowed) return { error: "rate_limited" };

  const target = await findValidAuthToken(token, kind);
  if (!target) return { error: "link" };

  const problem = checkPasswordPolicy(password, target.phone);
  if (problem) return { error: problem, field: "password" };
  if (password !== confirm) return { error: "mismatch", field: "confirm" };

  const user = await redeemAuthToken(token, kind, password);
  if (!user) return { error: "link" };

  await startSession(user.id);
  await recordLogin(user.id, locale);
  redirect({ href: homePathFor(user.role), locale });
}

export async function logoutAction(form: FormData): Promise<void> {
  const locale = localeOf(form.get("locale"));
  await endSession();
  redirect({ href: "/login", locale });
}

/** Remembers a logged-in user's language choice on their account. No-op for visitors. */
export async function saveLocalePreference(locale: Locale): Promise<void> {
  if (!hasLocale(routing.locales, locale)) return;
  const user = await getCurrentUser();
  if (user && user.locale !== locale) {
    await setPreferredLocale(user.id, locale);
  }
}
