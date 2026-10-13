import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Fixed-window counters for login and token endpoints (no Redis on the VPS). */
export const rateLimits = pgTable("rate_limits", {
  key: text().primaryKey(),
  windowStart: timestamp({ withTimezone: true }).notNull(),
  count: integer().notNull(),
});
