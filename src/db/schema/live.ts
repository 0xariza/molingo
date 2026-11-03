import { index, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sessions } from "./classes";
import { id } from "./_shared";
import { attendanceEventEnum } from "./enums";
import { users } from "./identity";

/** People Mona removed from a session's room: a new room token for that session is refused. */
export const sessionRemovals = pgTable(
  "session_removals",
  {
    sessionId: uuid()
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    removedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.userId] })],
);

/** Joins and leaves of a session's room, from LiveKit webhooks; time in the room is summed from them. */
export const attendanceEvents = pgTable(
  "attendance_events",
  {
    id: id(),
    sessionId: uuid()
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    event: attendanceEventEnum().notNull(),
    at: timestamp({ withTimezone: true }).notNull(),
    /** LiveKit's event id: a retried webhook inserts nothing. */
    livekitEventId: text().notNull().unique(),
  },
  (t) => [index().on(t.sessionId)],
);
