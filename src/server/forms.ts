import { z } from "zod";
import { locales, routing, type Locale } from "@/i18n/routing";
import { normalizePhone } from "@/lib/phone";

/** A FormData value as a string ("" when missing). */
export const text = (form: FormData, key: string) => String(form.get(key) ?? "");

/** The page's locale, sent as a hidden field (root params aren't available in Server Actions). */
export const formLocale = (form: FormData): Locale => {
  const locale = text(form, "locale");
  return locales.find((l) => l === locale) ?? routing.defaultLocale;
};

/** Zod issues → field name → its first error key. */
export function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const field = String(issue.path[0] ?? "");
    out[field] ??= issue.message;
  }
  return out;
}

/** A mobile number as typed (0912…, Persian digits, spaces) → E.164, or the `phone` error key. */
export const phoneField = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const phone = normalizePhone(v);
    if (!phone) ctx.addIssue({ code: "custom", message: "phone" });
    return phone ?? "";
  });
