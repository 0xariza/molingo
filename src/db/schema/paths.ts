import { sql } from "drizzle-orm";
import { check, index, pgTable, smallint, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { cefrLevelEnum } from "./enums";
import { teachers } from "./identity";

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
 * empty while the teacher is still filling the map in.
 */
export const stations = pgTable(
  "stations",
  {
    id: id(),
    sourceId: uuid()
      .notNull()
      .references(() => learningSources.id, { onDelete: "cascade" }),
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
