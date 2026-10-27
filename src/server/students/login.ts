import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { students, teacherLearners, users } from "@/db/schema";
import type { Locale } from "@/i18n/routing";
import { issueAuthToken, type AuthTokenKind } from "../auth/tokens";
import { isSoleTeacher } from "./learners";

/**
 * - `none`: no login yet
 * - `pending`: login created, activation link not used yet
 * - `active`: has set a password
 * - `off`: turned off (the learner left)
 */
export type LoginState = "none" | "pending" | "active" | "off";

export function loginState(user: { isActive: boolean; hasPassword: boolean } | null): LoginState {
  if (!user) return "none";
  if (!user.isActive) return "off";
  return user.hasPassword ? "active" : "pending";
}

/** A link shown to Mona once, to send on WhatsApp or Telegram. Only its hash is stored. */
export type LoginLink = { url: string; kind: AuthTokenKind; expiresAt: Date };

export type LoginLinkResult =
  | ({ ok: true } & LoginLink)
  | {
      ok: false;
      error: "not_found" | "has_login" | "no_login" | "login_off" | "phone_taken" | "shared";
    };

function linkUrl(token: string, kind: AuthTokenKind, locale: Locale) {
  const base = process.env.APP_URL;
  if (!base) throw new Error("APP_URL is not set");
  return `${base}/${locale}/${kind === "activation" ? "activate" : "reset"}/${token}`;
}

/** A one-time activation or reset link for any login (learners and teachers). */
export async function issueLink(
  userId: string,
  kind: AuthTokenKind,
  locale: Locale,
  createdBy: string,
) {
  const { token, expiresAt } = await issueAuthToken(userId, kind, createdBy);
  return { ok: true as const, url: linkUrl(token, kind, locale), kind, expiresAt };
}

/**
 * Creates the learner's login (mobile number + a password they choose) and its activation link.
 * Only the learner's sole teacher may: a login link lets whoever holds it into the account.
 */
export async function createLogin(
  teacherId: string,
  studentId: string,
  createdBy: string,
): Promise<LoginLinkResult> {
  type Created =
    | { error: "not_found" | "has_login" | "phone_taken" | "shared" }
    | { user: { id: string; locale: Locale } };
  const result = await db.transaction(async (tx): Promise<Created> => {
    const [learner] = await tx
      .select({
        userId: students.userId,
        phone: students.phone,
        name: students.fullNameFa,
        status: teacherLearners.status,
      })
      .from(students)
      .innerJoin(
        teacherLearners,
        and(eq(teacherLearners.studentId, students.id), eq(teacherLearners.teacherId, teacherId)),
      )
      .where(eq(students.id, studentId))
      .for("update");
    if (!learner) return { error: "not_found" };
    if (learner.userId) return { error: "has_login" };
    if (!(await isSoleTeacher(tx, teacherId, studentId))) return { error: "shared" };

    const [user] = await tx
      .insert(users)
      .values({
        phone: learner.phone,
        role: "student",
        displayName: learner.name,
        isActive: learner.status !== "left",
      })
      .onConflictDoNothing({ target: users.phone })
      .returning({ id: users.id, locale: users.locale });
    // Another account (e.g. a teacher's) already logs in with this number.
    if (!user) return { error: "phone_taken" };
    await tx.update(students).set({ userId: user.id }).where(eq(students.id, studentId));
    return { user };
  });
  if ("error" in result) return { ok: false, error: result.error };
  return issueLink(result.user.id, "activation", result.user.locale, createdBy);
}

/**
 * A fresh link for an existing login: activation until the learner has set a password, a
 * password reset after that. Issuing it turns the previous link of that kind off.
 */
export async function newLoginLink(
  teacherId: string,
  studentId: string,
  createdBy: string,
): Promise<LoginLinkResult> {
  const [row] = await db
    .select({
      userId: users.id,
      isActive: users.isActive,
      passwordHash: users.passwordHash,
      locale: users.locale,
    })
    .from(students)
    .innerJoin(
      teacherLearners,
      and(eq(teacherLearners.studentId, students.id), eq(teacherLearners.teacherId, teacherId)),
    )
    .leftJoin(users, eq(users.id, students.userId))
    .where(eq(students.id, studentId));
  if (!row) return { ok: false, error: "not_found" };
  if (!(await isSoleTeacher(db, teacherId, studentId))) return { ok: false, error: "shared" };
  if (!row.userId) return { ok: false, error: "no_login" };
  if (!row.isActive) return { ok: false, error: "login_off" };
  return issueLink(row.userId, row.passwordHash ? "reset" : "activation", row.locale!, createdBy);
}
