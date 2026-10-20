import { sql } from "drizzle-orm";
import {
  authTokens,
  classSlots,
  classes,
  enrollments,
  leads,
  levelCheckSlots,
  sessions,
  students,
  teachers,
  users,
} from "@/db/schema";
import { parseClock, sessionTimes, type Weekday } from "@/lib/schedule";
import { generateToken, hashToken } from "@/server/auth/crypto";
import { hashPassword } from "@/server/auth/password";
import type { TestDb } from "./database";

/** Empties every application table (keeps the schema). */
export async function resetDb(db: TestDb) {
  await db.execute(sql`
    do $$ declare r record; begin
      for r in select tablename from pg_tables where schemaname = 'public' loop
        execute 'truncate table ' || quote_ident(r.tablename) || ' restart identity cascade';
      end loop;
    end $$;`);
}

export async function createUser(
  db: TestDb,
  overrides: Partial<typeof users.$inferInsert> & { password?: string } = {},
) {
  const { password, ...rest } = overrides;
  const [user] = await db
    .insert(users)
    .values({
      phone: "+989121234567",
      role: "student",
      displayName: "Sara",
      passwordHash: password ? await hashPassword(password) : null,
      ...rest,
    })
    .returning();
  return user;
}

/** Inserts a one-time link token directly and returns the raw token for the URL. */
export async function createAuthToken(
  db: TestDb,
  userId: string,
  kind: "activation" | "reset",
  expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000),
) {
  const token = generateToken();
  await db.insert(authTokens).values({ id: hashToken(token), userId, kind, expiresAt });
  return token;
}

/** Opens a free-session time; with `bookedBy`, it is already taken by a lead with that name. */
export async function createLevelCheckSlot(
  db: TestDb,
  startsAt: Date,
  bookedBy?: { name: string; phone: string },
) {
  const [lead] = bookedBy
    ? await db
        .insert(leads)
        .values({ ...bookedBy, locale: "en", status: "scheduled" })
        .returning()
    : [];
  const [slot] = await db
    .insert(levelCheckSlots)
    .values({ startsAt, leadId: lead?.id })
    .returning();
  return slot;
}

/** Mona's teacher record (the MVP has one teacher). */
export async function createTeacher(db: TestDb, userId: string) {
  const [teacher] = await db.insert(teachers).values({ userId }).returning();
  return teacher;
}

let learnerCount = 0;

/** A learner; without a phone, a unique one is made up. */
export async function createLearner(
  db: TestDb,
  overrides: Partial<typeof students.$inferInsert> = {},
) {
  const n = ++learnerCount;
  const [learner] = await db
    .insert(students)
    .values({
      fullNameFa: `زبان‌آموز ${n}`,
      phone: `+98935000${String(n).padStart(4, "0")}`,
      status: "active",
      ...overrides,
    })
    .returning();
  return learner;
}

export type ClassInput = Partial<Omit<typeof classes.$inferInsert, "teacherId">> & {
  teacherId: string;
  /** Weekly times in Tehran time; weekday 0 = Saturday. */
  slots: { weekday: Weekday; time: string }[];
  startsOn: string;
  studentIds?: string[];
};

/**
 * A class with every session generated and its learners placed. Unlike the app, it allows
 * sessions in the past, so tests can start mid-course.
 */
export async function createClass(db: TestDb, { slots, studentIds = [], ...input }: ClassInput) {
  const values = {
    nameFa: "صبح A2",
    nameEn: "Morning A2",
    level: "A2",
    type: "group",
    capacity: 3,
    sessionCount: 12,
    sessionMinutes: 90,
    priceToman: 6_500_000,
    ...input,
  } satisfies typeof classes.$inferInsert;
  const [cls] = await db.insert(classes).values(values).returning();
  await db
    .insert(classSlots)
    .values(slots.map((s) => ({ classId: cls.id, weekday: s.weekday, startTime: s.time })));
  const times = sessionTimes({
    startsOn: values.startsOn,
    slots: slots.map((s) => ({ weekday: s.weekday, minutes: parseClock(s.time)! })),
    count: values.sessionCount,
    sessionMinutes: values.sessionMinutes,
  });
  const rows = await db
    .insert(sessions)
    .values(times.map((t) => ({ ...t, teacherId: values.teacherId, classId: cls.id })))
    .returning();
  if (studentIds.length > 0)
    await db
      .insert(enrollments)
      .values(studentIds.map((studentId) => ({ classId: cls.id, studentId })));
  return { ...cls, sessions: rows };
}
