import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { authSessions, users } from "@/db/schema";
import type { Locale } from "@/i18n/routing";
import { hashToken } from "./crypto";
import {
  checkPasswordPolicy,
  hashPassword,
  verifyPassword,
  type PasswordProblem,
} from "./password";

/** After any successful sign-in: the language used becomes the account's preferred language. */
export async function recordLogin(userId: string, locale: Locale): Promise<void> {
  await db.update(users).set({ lastLoginAt: new Date(), locale }).where(eq(users.id, userId));
}

export async function setPreferredLocale(userId: string, locale: Locale): Promise<void> {
  await db.update(users).set({ locale }).where(eq(users.id, userId));
}

export type PasswordChange = "ok" | "wrong" | "mismatch" | PasswordProblem;

/**
 * A logged-in user sets a new password after proving the current one; every other device is
 * signed out (the session behind `sessionToken` stays).
 */
export async function changePassword(
  user: { id: string; phone: string },
  input: { current: string; next: string; confirm: string },
  sessionToken: string,
): Promise<PasswordChange> {
  const [row] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, user.id));
  if (!row?.passwordHash || !(await verifyPassword(row.passwordHash, input.current)))
    return "wrong";
  const problem = checkPasswordPolicy(input.next, user.phone);
  if (problem) return problem;
  if (input.next !== input.confirm) return "mismatch";

  const passwordHash = await hashPassword(input.next);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash }).where(eq(users.id, user.id));
    await tx
      .delete(authSessions)
      .where(and(eq(authSessions.userId, user.id), ne(authSessions.id, hashToken(sessionToken))));
  });
  return "ok";
}
