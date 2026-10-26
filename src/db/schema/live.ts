import { pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";
import { sessions } from "./classes";
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
