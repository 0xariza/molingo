import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { cefrLevelEnum, recordingKindEnum, skillResultEnum } from "./enums";
import { classes, sessions } from "./classes";
import { students, teachers } from "./identity";
import { files } from "./homework";

/**
 * A book or course a teacher teaches from, at one level. Its station map is built once and reused
 * by every class on it. A source is complete when every station has a title and 3–4 skills.
 */
export const learningSources = pgTable(
  "learning_sources",
  {
    id: id(),
    teacherId: uuid()
      .notNull()
      .references(() => teachers.id, { onDelete: "restrict" }),
    title: text().notNull(),
    level: cefrLevelEnum().notNull(),
    archivedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [index().on(t.teacherId, t.level)],
);

/**
 * One chunk of a source (usually one chapter) that ends with a station check. `title` may be
 * empty while the teacher is still filling the map in. A station added for one class only has a
 * `classId` instead of a `sourceId`.
 */
export const stations = pgTable(
  "stations",
  {
    id: id(),
    sourceId: uuid().references(() => learningSources.id, { onDelete: "cascade" }),
    classId: uuid().references(() => classes.id, { onDelete: "cascade" }),
    position: smallint().notNull(),
    title: text().notNull().default(""),
    /** Where it sits in the book, e.g. "فصل ۳". */
    sourceUnit: text().notNull().default(""),
    plannedSessions: smallint().notNull(),
    ...timestamps,
  },
  (t) => [
    index().on(t.sourceId, t.position),
    check("stations_planned_sessions_check", sql`${t.plannedSessions} between 1 and 4`),
    check("stations_owner_check", sql`(${t.sourceId} is null) <> (${t.classId} is null)`),
  ],
);

/** An observable can-do of a station ("می‌گوید دیروز چه کار کرد"). */
export const stationSkills = pgTable(
  "station_skills",
  {
    id: id(),
    stationId: uuid()
      .notNull()
      .references(() => stations.id, { onDelete: "cascade" }),
    position: smallint().notNull(),
    text: text().notNull(),
  },
  (t) => [index().on(t.stationId, t.position)],
);

/** A class's path: the source it follows. Optional; a class can run without one. */
export const classPaths = pgTable("class_paths", {
  id: id(),
  classId: uuid()
    .notNull()
    .unique()
    .references(() => classes.id, { onDelete: "cascade" }),
  sourceId: uuid()
    .notNull()
    .references(() => learningSources.id, { onDelete: "restrict" }),
  ...timestamps,
});

/**
 * The class's own order of stations: which source stations it uses, how many sessions each gets
 * here, and its class-only stations. Sessions are assigned to these rows in order.
 */
export const classPathStations = pgTable(
  "class_path_stations",
  {
    id: id(),
    pathId: uuid()
      .notNull()
      .references(() => classPaths.id, { onDelete: "cascade" }),
    stationId: uuid()
      .notNull()
      .references(() => stations.id, { onDelete: "restrict" }),
    position: smallint().notNull(),
    included: boolean().notNull().default(true),
    plannedSessions: smallint().notNull(),
    /** Set by the teacher in the station check ("station done"); never by holding a session. */
    closedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    uniqueIndex().on(t.pathId, t.stationId),
    index().on(t.pathId, t.position),
    check("class_path_stations_planned_check", sql`${t.plannedSessions} between 1 and 4`),
  ],
);

/** Skills of the session's station that a held session worked on (the after-class page). */
export const sessionSkills = pgTable(
  "session_skills",
  {
    sessionId: uuid()
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    stationSkillId: uuid()
      .notNull()
      .references(() => stationSkills.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.stationSkillId] })],
);

/** A learner's result for one station skill, from the station check. Skills travel with the learner. */
export const studentSkills = pgTable(
  "student_skills",
  {
    studentId: uuid()
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    stationSkillId: uuid()
      .notNull()
      .references(() => stationSkills.id, { onDelete: "cascade" }),
    result: skillResultEnum().notNull(),
    sessionId: uuid().references(() => sessions.id, { onDelete: "set null" }),
    checkedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.stationSkillId] })],
);

/** The learner's own voice: the first-day "before" and a later "after". Private to learner and teacher. */
export const voiceRecordings = pgTable(
  "voice_recordings",
  {
    id: id(),
    studentId: uuid()
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    kind: recordingKindEnum().notNull(),
    fileId: uuid()
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.studentId, t.createdAt)],
);
