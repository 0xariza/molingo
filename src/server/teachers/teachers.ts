import { and, asc, count, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { authSessions, teacherLearners, teachers, users } from "@/db/schema";
import type { Locale } from "@/i18n/routing";
import { phoneField } from "../forms";

/**
 * Page addresses that would shadow a route or confuse people. Static routes win over `/[slug]`
 * anyway; this keeps a teacher from taking an address that already means something.
 */
export const RESERVED_SLUGS = new Set([
  "fa",
  "en",
  "j",
  "l",
  "admin",
  "app",
  "owner",
  "api",
  "login",
  "logout",
  "activate",
  "reset",
  "styleguide",
  "privacy",
  "terms",
  "about",
  "help",
  "support",
  "hoopo",
  "teachers",
  "teacher",
  "signup",
  "register",
  "_next",
  "static",
  "public",
  "assets",
  "fonts",
  "icon",
  "favicon",
]);

export const slugField = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z][a-z0-9-]{1,29}$/, "slug")
  .refine((v) => !v.endsWith("-") && !v.includes("--"), "slug")
  .refine((v) => !RESERVED_SLUGS.has(v), "slug_reserved");

/** Error keys map to messages under `Owner.errors`. */
export const newTeacherSchema = z.object({
  nameFa: z.string().trim().min(2, "nameFa").max(60, "nameFa"),
  nameEn: z.string().trim().min(2, "nameEn").max(60, "nameEn"),
  brandName: z.string().trim().min(2, "brandName").max(60, "brandName"),
  phone: phoneField,
  slug: slugField,
});

export type NewTeacher = z.output<typeof newTeacherSchema>;

/** What a teacher's public page shows. Null for an unknown or paused teacher. */
export async function teacherPage(slug: string, locale: Locale) {
  const [row] = await db
    .select({
      id: teachers.id,
      slug: teachers.slug,
      brandName: teachers.brandName,
      nameFa: teachers.nameFa,
      nameEn: teachers.nameEn,
      bio: teachers.bio,
    })
    .from(teachers)
    .innerJoin(users, eq(users.id, teachers.userId))
    .where(and(eq(teachers.slug, slug.toLowerCase()), eq(users.isActive, true)));
  if (!row) return null;
  const { nameFa, nameEn, ...rest } = row;
  return { ...rest, name: locale === "fa" ? nameFa : nameEn };
}

export type TeacherPage = NonNullable<Awaited<ReturnType<typeof teacherPage>>>;

// shortcut: hoopo.ir goes to the first teacher's page (Mona) until the platform home page (M6d).
export async function homeTeacherSlug(): Promise<string | null> {
  const [row] = await db
    .select({ slug: teachers.slug })
    .from(teachers)
    .orderBy(asc(teachers.createdAt), asc(teachers.id))
    .limit(1);
  return row?.slug ?? null;
}

export type TeacherRow = {
  id: string;
  userId: string;
  brandName: string;
  nameFa: string;
  nameEn: string;
  slug: string;
  phone: string;
  learners: number;
  /** `pending`: the activation link hasn't been used yet. */
  status: "active" | "paused" | "pending";
};

/** Every teacher for the owner's page, oldest first, with how many learners they have. */
export async function listTeachers(): Promise<TeacherRow[]> {
  const rows = await db
    .select({
      id: teachers.id,
      userId: users.id,
      brandName: teachers.brandName,
      nameFa: teachers.nameFa,
      nameEn: teachers.nameEn,
      slug: teachers.slug,
      phone: users.phone,
      isActive: users.isActive,
      hasPassword: sql<boolean>`${users.passwordHash} is not null`,
      learners: sql<number>`(select count(*)::int from ${teacherLearners} l where l.teacher_id = ${teachers.id} and l.status <> 'left')`,
    })
    .from(teachers)
    .innerJoin(users, eq(users.id, teachers.userId))
    .orderBy(asc(teachers.createdAt), asc(teachers.id));
  return rows.map(({ isActive, hasPassword, ...r }) => ({
    ...r,
    status: !isActive ? "paused" : hasPassword ? "active" : "pending",
  }));
}

export type CreateTeacherResult =
  { ok: true; userId: string } | { ok: false; error: "phone_taken" | "slug_taken" };

/**
 * Adds a teacher: their login (no password until they open the activation link) and their
 * teacher record. A number that already logs in (a learner, another teacher) is refused.
 */
export async function createTeacher(input: NewTeacher): Promise<CreateTeacherResult> {
  return db.transaction(async (tx) => {
    const [slugTaken] = await tx
      .select({ n: count() })
      .from(teachers)
      .where(eq(teachers.slug, input.slug));
    if (slugTaken.n > 0) return { ok: false as const, error: "slug_taken" as const };
    const [user] = await tx
      .insert(users)
      .values({ phone: input.phone, role: "teacher", displayName: input.nameFa, locale: "fa" })
      .onConflictDoNothing({ target: users.phone })
      .returning({ id: users.id });
    if (!user) return { ok: false as const, error: "phone_taken" as const };
    await tx.insert(teachers).values({
      userId: user.id,
      slug: input.slug,
      brandName: input.brandName,
      nameFa: input.nameFa,
      nameEn: input.nameEn,
    });
    return { ok: true as const, userId: user.id };
  });
}

/** Pausing a teacher turns their login and public page off and signs them out; resuming undoes it. */
export async function setTeacherActive(teacherId: string, active: boolean): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [teacher] = await tx
      .select({ userId: teachers.userId })
      .from(teachers)
      .where(eq(teachers.id, teacherId));
    if (!teacher) return false;
    await tx
      .update(users)
      .set({ isActive: active })
      .where(and(eq(users.id, teacher.userId), ne(users.role, "owner")));
    if (!active) await tx.delete(authSessions).where(eq(authSessions.userId, teacher.userId));
    return true;
  });
}

/** The teacher's login, for a fresh activation link (only before they've set a password). */
export async function pendingTeacherUser(teacherId: string) {
  const [row] = await db
    .select({ userId: users.id })
    .from(teachers)
    .innerJoin(users, eq(users.id, teachers.userId))
    .where(
      and(eq(teachers.id, teacherId), sql`${users.passwordHash} is null`, eq(users.isActive, true)),
    );
  return row?.userId ?? null;
}

/** What a teacher edits about their own page ("My page"). */
export const myPageSchema = z.object({
  brandName: z.string().trim().min(2, "brandName").max(60, "brandName"),
  bio: z
    .string()
    .trim()
    .max(1000, "bio")
    .transform((v) => v || null),
});

export async function myPage(teacherId: string) {
  const [row] = await db
    .select({ brandName: teachers.brandName, bio: teachers.bio, slug: teachers.slug })
    .from(teachers)
    .where(eq(teachers.id, teacherId));
  return row ?? null;
}

export async function updateMyPage(teacherId: string, input: z.output<typeof myPageSchema>) {
  await db.update(teachers).set(input).where(eq(teachers.id, teacherId));
}
