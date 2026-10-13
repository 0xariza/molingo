import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { citext, id, timestamps } from "./_shared";
import { localeEnum, leadStatusEnum } from "./enums";
import { students } from "./identity";

export const leads = pgTable(
  "leads",
  {
    id: id(),
    name: text().notNull(),
    phone: text().notNull(),
    email: citext(),
    preferredTimes: text(),
    selfAssessedLevel: text(),
    message: text(),
    locale: localeEnum().notNull(),
    source: text(),
    status: leadStatusEnum().notNull().default("new"),
    convertedStudentId: uuid().references(() => students.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index().on(t.status, t.createdAt)],
);

export const waitlistEmails = pgTable("waitlist_emails", {
  id: id(),
  email: citext().notNull().unique(),
  locale: localeEnum().notNull(),
  source: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
