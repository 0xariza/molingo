import "server-only";
import { getLocale } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { redirect } from "@/i18n/navigation";
import { getClientIp } from "../request";
import { homePathFor, isAdmin, isStudent } from "./policy";
import { SESSION_COOKIE, sessionCookieOptions } from "./constants";
import {
  createSession,
  invalidateSession,
  validateSessionToken,
  type SessionUser,
} from "./sessions";

/** Current user for this request (deduplicated per render), or null. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  // Session checks compare against the current time, so they always run per request.
  await connection();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return validateSessionToken(token);
});

async function loginRedirect(): Promise<never> {
  const locale = await getLocale();
  return redirect({ href: "/login", locale });
}

export async function requireUser(): Promise<SessionUser> {
  return (await getCurrentUser()) ?? loginRedirect();
}

/** Use in every admin page, Server Action and data function. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (isAdmin(user.role)) return user;
  // Students go to their own area; other roles (future teachers) have no admin access yet.
  if (isStudent(user.role)) return redirect({ href: "/app", locale: await getLocale() });
  notFound();
}

/** Use in every student page, Server Action and data function. */
export async function requireStudent(): Promise<SessionUser> {
  const user = await requireUser();
  if (isStudent(user.role)) return user;
  return redirect({ href: homePathFor(user.role), locale: await getLocale() });
}

/** Server Actions only (cookies can't be set while rendering). */
export async function startSession(userId: string): Promise<void> {
  const h = await headers();
  const { token } = await createSession(userId, {
    userAgent: h.get("user-agent"),
    ip: await getClientIp(),
  });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
}

/** Server Actions only. */
export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await invalidateSession(token);
  jar.delete(SESSION_COOKIE);
}
