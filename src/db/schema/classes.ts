import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  date,
  index,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import {
  attendanceStatusEnum,
  cefrLevelEnum,
  classTypeEnum,
  enrollmentStatusEnum,
  sessionKindEnum,
  sessionStatusEnum,
} from "./enums";
import { students, teachers } from "./identity";

/**
 * A class runs a fixed number of sessions from `startsOn` on its weekly slots. Private classes
 * have one learner and are priced per session; group classes take 2–4 and are priced per learner
 * for the whole course. A class is finished once no session is still scheduled.
 */
export const classes = pgTable(
  "classes",
  {
    id: id(),
    teacherId: uuid()
      .notNull()
      .references(() => teachers.id, { onDelete: "restrict" }),
    nameFa: text().notNull(),
    /** Shown in the English UI; falls back to the Persian name when empty. */
    nameEn: text(),
    level: cefrLevelEnum().notNull(),
    type: classTypeEnum().notNull(),
    capacity: smallint().notNull(),
    sessionCount: smallint().notNull(),
    sessionMinutes: smallint().notNull(),
    /** Tehran calendar date of the first session. */
    startsOn: date({ mode: "string" }).notNull(),
    /** Toman. Private: per held session. Group: per learner for the whole course. */
    priceToman: bigint({ mode: "number" }).notNull(),
    description: text(),
    /** Group classes only: shown on the landing page while seats are free. */
    isPublic: boolean().notNull().default(false),
    archivedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    check(
      "classes_capacity_check",
      sql`(${t.type} = 'private' and ${t.capacity} = 1) or (${t.type} = 'group' and ${t.capacity} between 2 and 4)`,
    ),
    check("classes_session_count_check", sql`${t.sessionCount} between 1 and 60`),
    check("classes_session_minutes_check", sql`${t.sessionMinutes} between 15 and 240`),
    check("classes_price_check", sql`${t.priceToman} > 0`),
    check("classes_public_check", sql`not (${t.isPublic} and ${t.type} = 'private')`),
    index().on(t.archivedAt),
  ],
);

/** Weekly times, in Tehran wall-clock time. Weekday 0 = Saturday … 6 = Friday. */
export const classSlots = pgTable(
  "class_slots",
  {
    id: id(),
    classId: uuid()
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    weekday: smallint().notNull(),
    startTime: time().notNull(),
  },
  (t) => [
    uniqueIndex().on(t.classId, t.weekday),
    check("class_slots_weekday_check", sql`${t.weekday} between 0 and 6`),
  ],
);

/**
 * One meeting. Teacher overlaps are refused by an exclusion constraint (custom migration) on
 * every session that isn't cancelled. Make-up sessions list their learners in
 * `session_participants`; class sessions are for the class's active learners.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    teacherId: uuid()
      .notNull()
      .references(() => teachers.id, { onDelete: "restrict" }),
    classId: uuid()
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    kind: sessionKindEnum().notNull().default("class"),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    status: sessionStatusEnum().notNull().default("scheduled"),
    cancelReason: text(),
    /** Set when Mona moves a session: where it was first scheduled. */
    movedFrom: timestamp({ withTimezone: true }),
    /** A make-up session can replace one that was cancelled. */
    replacesSessionId: uuid().references((): AnyPgColumn => sessions.id, { onDelete: "set null" }),
    heldAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    check("sessions_time_check", sql`${t.endsAt} > ${t.startsAt}`),
    index().on(t.classId, t.startsAt),
    index().on(t.startsAt),
  ],
);

export const sessionParticipants = pgTable(
  "session_participants",
  {
    sessionId: uuid()
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    studentId: uuid()
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.studentId] })],
);

/** A learner's place in a class. Ending it keeps the row, so past learners stay listed. */
export const enrollments = pgTable(
  "enrollments",
  {
    id: id(),
    classId: uuid()
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    studentId: uuid()
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
    status: enrollmentStatusEnum().notNull().default("active"),
    startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    uniqueIndex("enrollments_one_active_index")
      .on(t.classId, t.studentId)
      .where(sql`${t.status} = 'active'`),
    index().on(t.studentId),
  ],
);

/**
 * Who attended a held session. `present` and `absent` are charged; `excused` is not (Mona's
 * "absent, not charged").
 */
export const attendance = pgTable(
  "attendance",
  {
    sessionId: uuid()
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    studentId: uuid()
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
    status: attendanceStatusEnum().notNull(),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.studentId] })],
);
