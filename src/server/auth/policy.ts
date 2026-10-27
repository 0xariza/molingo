import type { SessionUser } from "./sessions";

export type Role = SessionUser["role"];

/** A teacher runs their own panel (/admin); the owner only manages teachers (/owner). */
export const isTeacher = (role: Role) => role === "teacher";
export const isOwner = (role: Role) => role === "owner";
export const isStudent = (role: Role) => role === "student";

const HOME = { owner: "/owner", teacher: "/admin", student: "/app" } as const;

/** Where a user lands after login (without locale prefix). */
export function homePathFor(role: Role): (typeof HOME)[Role] {
  return HOME[role];
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
