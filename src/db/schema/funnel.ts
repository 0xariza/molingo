import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { citext, id, timestamps } from "./_shared";
import { leadStatusEnum, levelGuessEnum, localeEnum } from "./enums";

/** Free level-check bookings from the landing page. Mona follows up and converts them (M4). */
export const leads = pgTable(
  "leads",
  {
    id: id(),
    name: text().notNull(),
    /** E.164 */
    phone: text().notNull(),
    levelGuess: levelGuessEnum().notNull().default("unsure"),
    locale: localeEnum().notNull(),
    status: leadStatusEnum().notNull().default("new"),
    ...timestamps,
  },
  (t) => [index().on(t.status, t.createdAt), index().on(t.phone)],
);

/**
 * Times Mona has opened for a free level check. A visitor books one by taking it: `leadId` is set
 * once and the slot is then no longer offered. Length is fixed (LEVEL_CHECK_MINUTES).
 */
export const levelCheckSlots = pgTable("level_check_slots", {
  id: id(),
  startsAt: timestamp({ withTimezone: true }).notNull().unique(),
  leadId: uuid()
    .unique()
    .references(() => leads.id, { onDelete: "set null" }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/** AI self-study waitlist (Phase 3). */
export const waitlistEmails = pgTable("waitlist_emails", {
  id: id(),
  email: citext().notNull().unique(),
  locale: localeEnum().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
