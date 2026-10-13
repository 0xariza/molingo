import type { SessionUser } from "./sessions";

export type Role = SessionUser["role"];

/** Mona is `admin`. `teacher` is reserved for future extra teachers (no admin rights). */
export const isAdmin = (role: Role) => role === "admin";
export const isStudent = (role: Role) => role === "student";

/** Where a user lands after login (without locale prefix). */
export function homePathFor(role: Role): "/admin" | "/app" {
  return role === "student" ? "/app" : "/admin";
}

/**
 * Validates a `next` redirect target: it must be a same-site path inside the area the role
 * may enter. Prevents open redirects (`//evil.com`, `https://…`) and students landing on /admin.
 * `next` is locale-free, e.g. "/app/homework".
 */
export function safeNextPath(next: string | null | undefined, role: Role): string {
  const home = homePathFor(role);
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return home;
  return next === home || next.startsWith(`${home}/`) ? next : home;
}
