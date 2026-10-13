import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import type { Locale } from "@/i18n/routing";

/** After any successful sign-in: the language used becomes the account's preferred language. */
export async function recordLogin(userId: string, locale: Locale): Promise<void> {
  await db.update(users).set({ lastLoginAt: new Date(), locale }).where(eq(users.id, userId));
}

export async function setPreferredLocale(userId: string, locale: Locale): Promise<void> {
  await db.update(users).set({ locale }).where(eq(users.id, userId));
}
