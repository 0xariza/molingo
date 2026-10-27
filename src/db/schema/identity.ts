import {
  boolean,
  index,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { citext, id, timestamps } from "./_shared";
import { leads } from "./funnel";
import { authTokenKindEnum, localeEnum, studentStatusEnum, userRoleEnum } from "./enums";

export const users = pgTable("users", {
  id: id(),
  /** E.164, e.g. +989121234567. The login identifier. */
  phone: text().notNull().unique(),
  email: citext(),
  /** Null until the user opens their activation link and sets a password. */
  passwordHash: text(),
  role: userRoleEnum().notNull(),
  displayName: text().notNull(),
  locale: localeEnum().notNull().default("fa"),
  isActive: boolean().notNull().default(true),
  lastLoginAt: timestamp({ withTimezone: true }),
  ...timestamps,
});

export const authSessions = pgTable(
  "auth_sessions",
  {
    /** SHA-256 hex of the session token; the raw token only lives in the cookie. */
    id: text().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    userAgent: text(),
    ip: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.userId)],
);

export const authTokens = pgTable(
  "auth_tokens",
  {
    /** SHA-256 hex of the token sent in the link. */
    id: text().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: authTokenKindEnum().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    usedAt: timestamp({ withTimezone: true }),
    createdBy: uuid().references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.userId)],
);

export const teachers = pgTable("teachers", {
  id: id(),
  userId: uuid()
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "restrict" }),
  /** Their public page: hoopo.ir/<slug>. Lowercase Latin; reserved words are refused. */
  slug: citext().notNull().unique(),
  /** What learners see: "Mona English". Hoopo shows only as "powered by hoopo". */
  brandName: text().notNull(),
  /** How their page names them in each language ("مونا" / "Mona"). */
  nameFa: text().notNull(),
  nameEn: text().notNull(),
  bio: text(),
  weeklyHourLimit: smallint().notNull().default(29),
  dailyHourLimit: smallint().notNull().default(6),
  ...timestamps,
});

/**
 * One person learning on the platform: one row per mobile number, shared by every teacher they
 * study with. What a teacher knows about them (status, notes) lives on `teacherLearners`.
 */
export const students = pgTable("students", {
  id: id(),
  /** Null until a teacher creates the learner's login. */
  userId: uuid()
    .unique()
    .references(() => users.id, { onDelete: "set null" }),
  fullNameFa: text().notNull(),
  /** Shown in the English UI; falls back to the Persian name when empty. */
  fullNameEn: text(),
  /** E.164. One learner per number. */
  phone: text().notNull().unique(),
  email: citext(),
  messengerHandle: text(),
  ...timestamps,
});

/** A teacher's own record of a learner: each teacher sees only their links. */
export const teacherLearners = pgTable(
  "teacher_learners",
  {
    teacherId: uuid()
      .notNull()
      .references(() => teachers.id, { onDelete: "restrict" }),
    studentId: uuid()
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    status: studentStatusEnum().notNull().default("lead"),
    /** The teacher's private notes. */
    notes: text(),
    /** The free-session booking this learner came from. */
    leadId: uuid()
      .unique()
      .references(() => leads.id, { onDelete: "set null" }),
    /** First time the learner became active with this teacher ("new learners per month"). */
    startedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    primaryKey({ columns: [t.teacherId, t.studentId] }),
    index().on(t.teacherId, t.status),
    index().on(t.teacherId, t.startedAt),
  ],
);
