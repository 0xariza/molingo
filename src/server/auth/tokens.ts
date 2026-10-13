import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { authSessions, authTokens, users } from "@/db/schema";
import { generateToken, hashToken } from "./crypto";
import { hashPassword } from "./password";

export type AuthTokenKind = "activation" | "reset";

const LIFETIME_MS: Record<AuthTokenKind, number> = {
  activation: 7 * 24 * 60 * 60 * 1000,
  reset: 24 * 60 * 60 * 1000,
};

/**
 * Creates a one-time link token. Any earlier unused token of the same kind for the user
 * stops working, so only the most recently shared link is valid.
 */
export async function issueAuthToken(
  userId: string,
  kind: AuthTokenKind,
  createdBy?: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + LIFETIME_MS[kind]);
  await db.transaction(async (tx) => {
    await tx
      .update(authTokens)
      .set({ usedAt: new Date() })
      .where(
        and(eq(authTokens.userId, userId), eq(authTokens.kind, kind), isNull(authTokens.usedAt)),
      );
    await tx.insert(authTokens).values({
      id: hashToken(token),
      userId,
      kind,
      expiresAt,
      createdBy: createdBy ?? null,
    });
  });
  return { token, expiresAt };
}

export async function findValidAuthToken(token: string, kind: AuthTokenKind) {
  const [row] = await db
    .select({ userId: users.id, displayName: users.displayName, phone: users.phone })
    .from(authTokens)
    .innerJoin(users, eq(users.id, authTokens.userId))
    .where(
      and(
        eq(authTokens.id, hashToken(token)),
        eq(authTokens.kind, kind),
        isNull(authTokens.usedAt),
        gt(authTokens.expiresAt, new Date()),
        eq(users.isActive, true),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Sets the password and burns the token in one transaction. All existing sessions are
 * signed out, so a reset also locks out anyone using an old session.
 * Returns the user, or null if the token was invalid or already used.
 */
class InactiveUser extends Error {}

export async function redeemAuthToken(
  token: string,
  kind: AuthTokenKind,
  newPassword: string,
): Promise<{ id: string; role: (typeof users.$inferSelect)["role"] } | null> {
  const passwordHash = await hashPassword(newPassword);
  try {
    return await db.transaction(async (tx) => {
      const [used] = await tx
        .update(authTokens)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(authTokens.id, hashToken(token)),
            eq(authTokens.kind, kind),
            isNull(authTokens.usedAt),
            gt(authTokens.expiresAt, new Date()),
          ),
        )
        .returning({ userId: authTokens.userId });
      if (!used) return null;

      const [user] = await tx
        .update(users)
        .set({ passwordHash })
        .where(and(eq(users.id, used.userId), eq(users.isActive, true)))
        .returning({ id: users.id, role: users.role });
      // Throwing rolls back, so the token stays unused for a deactivated account.
      if (!user) throw new InactiveUser();

      await tx.delete(authSessions).where(eq(authSessions.userId, user.id));
      return user;
    });
  } catch (e) {
    if (e instanceof InactiveUser) return null;
    throw e;
  }
}
