import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { authSessions, users } from "@/db/schema";
import { generateToken, hashToken } from "./crypto";

import { SESSION_DAYS } from "./constants";
const DAY_MS = 24 * 60 * 60 * 1000;
/** Extend the session when less than half of its lifetime is left (sliding expiry). */
const RENEW_THRESHOLD_MS = (SESSION_DAYS / 2) * DAY_MS;

export type SessionUser = {
  id: string;
  role: (typeof users.$inferSelect)["role"];
  displayName: string;
  phone: string;
  locale: (typeof users.$inferSelect)["locale"];
};

export async function createSession(
  userId: string,
  meta: { userAgent?: string | null; ip?: string | null } = {},
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY_MS);
  await db.insert(authSessions).values({
    id: hashToken(token),
    userId,
    expiresAt,
    userAgent: meta.userAgent?.slice(0, 300) ?? null,
    ip: meta.ip ?? null,
  });
  return { token, expiresAt };
}

/** Returns the user for a valid session token, extending the session if it is past halfway. */
export async function validateSessionToken(token: string): Promise<SessionUser | null> {
  const id = hashToken(token);
  const [row] = await db
    .select({
      expiresAt: authSessions.expiresAt,
      user: {
        id: users.id,
        role: users.role,
        displayName: users.displayName,
        phone: users.phone,
        locale: users.locale,
        isActive: users.isActive,
      },
    })
    .from(authSessions)
    .innerJoin(users, eq(users.id, authSessions.userId))
    .where(and(eq(authSessions.id, id), gt(authSessions.expiresAt, new Date())))
    .limit(1);

  if (!row) return null;
  if (!row.user.isActive) {
    await db.delete(authSessions).where(eq(authSessions.id, id));
    return null;
  }
  if (row.expiresAt.getTime() - Date.now() < RENEW_THRESHOLD_MS) {
    await db
      .update(authSessions)
      .set({ expiresAt: new Date(Date.now() + SESSION_DAYS * DAY_MS) })
      .where(eq(authSessions.id, id));
  }
  const { id: userId, role, displayName, phone, locale } = row.user;
  return { id: userId, role, displayName, phone, locale };
}

export async function invalidateSession(token: string): Promise<void> {
  await db.delete(authSessions).where(eq(authSessions.id, hashToken(token)));
}
