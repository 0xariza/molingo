import { boolean, index, pgTable, smallint, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { citext, id, timestamps } from "./_shared";
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
  bio: text(),
  weeklyHourLimit: smallint().notNull().default(29),
  dailyHourLimit: smallint().notNull().default(6),
  ...timestamps,
});

export const students = pgTable(
  "students",
  {
    id: id(),
    /** Null for leads that have not been given an account yet. */
    userId: uuid()
      .unique()
      .references(() => users.id, { onDelete: "set null" }),
    fullName: text().notNull(),
    phone: text().notNull(),
    email: citext(),
    messengerHandle: text(),
    status: studentStatusEnum().notNull().default("lead"),
    preferredLocale: localeEnum().notNull().default("fa"),
    /** FK to level_stages is added with the levels schema (M9). */
    currentStageId: uuid(),
    /** Private admin notes. */
    notes: text(),
    leadId: uuid(),
    startedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [index().on(t.status), index().on(t.phone)],
);
