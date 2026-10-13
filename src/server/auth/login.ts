import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { normalizePhone } from "@/lib/phone";
import { getDummyHash, verifyPassword } from "./password";
import { consumeRateLimit, resetRateLimit } from "../rate-limit";

export type LoginError = "invalid" | "rate_limited";
export type LoginResult =
  | { ok: true; user: { id: string; role: (typeof users.$inferSelect)["role"] } }
  | { ok: false; error: LoginError };

const WINDOW_SEC = 15 * 60;
export const LOGIN_LIMITS = { perPhone: 5, perIp: 20, global: 500 } as const;

/**
 * Checks phone + password. Unknown phone, wrong password, unactivated or deactivated
 * accounts all return the same `invalid` error so the form doesn't reveal who has an account.
 */
export async function authenticate(
  phoneInput: string,
  password: string,
  ip: string,
): Promise<LoginResult> {
  const phone = normalizePhone(phoneInput) ?? phoneInput.trim().slice(0, 32);
  const phoneKey = `login:phone:${phone}`;

  const checks = await Promise.all([
    consumeRateLimit(phoneKey, LOGIN_LIMITS.perPhone, WINDOW_SEC),
    consumeRateLimit(`login:ip:${ip}`, LOGIN_LIMITS.perIp, WINDOW_SEC),
    consumeRateLimit("login:global", LOGIN_LIMITS.global, WINDOW_SEC),
  ]);
  if (checks.some((c) => !c.allowed)) return { ok: false, error: "rate_limited" };

  const [user] = await db
    .select({
      id: users.id,
      role: users.role,
      passwordHash: users.passwordHash,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1);

  const valid = await verifyPassword(user?.passwordHash ?? (await getDummyHash()), password);
  if (!user || !user.passwordHash || !user.isActive || !valid) {
    return { ok: false, error: "invalid" };
  }

  await resetRateLimit(phoneKey);
  return { ok: true, user: { id: user.id, role: user.role } };
}
