import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { classes, sessions } from "./classes";
import { files } from "./homework";
import { students, teachers } from "./identity";

/** All money below is integer Toman. */
export const invoiceKindEnum = pgEnum("invoice_kind", ["monthly", "course"]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["draft", "issued", "void"]);
export const invoiceLineKindEnum = pgEnum("invoice_line_kind", [
  "session",
  "course_fee",
  "adjustment",
  "credit",
]);
export const paymentMethodEnum = pgEnum("payment_method", ["card", "cash", "bank", "other"]);
export const receiptStatusEnum = pgEnum("receipt_status", ["pending", "approved", "rejected"]);
export const smsStatusEnum = pgEnum("sms_status", ["logged", "sent", "failed", "skipped"]);
export const creditReasonEnum = pgEnum("credit_reason", [
  "move",
  "overpayment",
  "applied",
  "reversed",
]);

/**
 * A private class's per-session price changes. The class's own `priceToman` is the price from
 * its first day; a session costs the latest row on or before its date, so old invoices never move.
 */
export const classPrices = pgTable(
  "class_prices",
  {
    id: id(),
    classId: uuid()
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    priceToman: bigint({ mode: "number" }).notNull(),
    /** Tehran calendar date from which the price applies. */
    effectiveFrom: date({ mode: "string" }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex().on(t.classId, t.effectiveFrom),
    check("class_prices_price_check", sql`${t.priceToman} > 0`),
  ],
);

/**
 * What one learner owes for one class: a month of held sessions (private) or the whole course fee
 * (group). The total is the sum of its lines. A draft is invisible to the learner.
 */
export const invoices = pgTable(
  "invoices",
  {
    id: id(),
    teacherId: uuid()
      .notNull()
      .references(() => teachers.id, { onDelete: "restrict" }),
    studentId: uuid()
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
    classId: uuid()
      .notNull()
      .references(() => classes.id, { onDelete: "restrict" }),
    kind: invoiceKindEnum().notNull(),
    /** Jalali month "1405-08" for monthly invoices. */
    period: text(),
    status: invoiceStatusEnum().notNull().default("draft"),
    /** The number shown to people ("۰۰۱۴"). */
    number: integer().generatedAlwaysAsIdentity(),
    /** Public id in the SMS link (hoopo.ir/b/<code>); the page still needs the learner's login. */
    shortCode: text().notNull().unique(),
    issuedAt: timestamp({ withTimezone: true }),
    /** Tehran date; unpaid after this plus the grace days means overdue. */
    dueOn: date({ mode: "string" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("invoices_one_month_index")
      .on(t.studentId, t.classId, t.period)
      .where(sql`${t.kind} = 'monthly' and ${t.status} <> 'void'`),
    uniqueIndex("invoices_one_course_index")
      .on(t.studentId, t.classId)
      .where(sql`${t.kind} = 'course' and ${t.status} <> 'void'`),
    index().on(t.teacherId, t.status),
    index().on(t.studentId),
    check("invoices_period_check", sql`(${t.kind} = 'monthly') = (${t.period} is not null)`),
  ],
);

/** A line's amount is signed: charges are positive, credits and discounts negative. */
export const invoiceLines = pgTable(
  "invoice_lines",
  {
    id: id(),
    invoiceId: uuid()
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    kind: invoiceLineKindEnum().notNull(),
    description: text().notNull(),
    /** The charged session of a `session` line. */
    sessionId: uuid().references(() => sessions.id, { onDelete: "set null" }),
    amountToman: bigint({ mode: "number" }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.invoiceId)],
);

/** A session is billed to a learner once; rows go away when the invoice is voided. */
export const billedSessions = pgTable(
  "billed_sessions",
  {
    sessionId: uuid()
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    studentId: uuid()
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    invoiceId: uuid()
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.studentId] })],
);

/** "Don't charge this session" (any reason beyond an excused absence or a cancellation). */
export const billingExemptions = pgTable(
  "billing_exemptions",
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

/** Money that reached the teacher. An invoice's paid amount is the sum of its payments. */
export const payments = pgTable(
  "payments",
  {
    id: id(),
    teacherId: uuid()
      .notNull()
      .references(() => teachers.id, { onDelete: "restrict" }),
    studentId: uuid()
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
    invoiceId: uuid().references(() => invoices.id, { onDelete: "restrict" }),
    amountToman: bigint({ mode: "number" }).notNull(),
    paidOn: date({ mode: "string" }).notNull(),
    method: paymentMethodEnum().notNull(),
    reference: text(),
    note: text(),
    /** The approved receipt this payment came from. */
    receiptId: uuid().unique(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index().on(t.invoiceId),
    index().on(t.teacherId, t.paidOn),
    check("payments_amount_check", sql`${t.amountToman} > 0`),
  ],
);

/** A learner's proof of a card-to-card transfer; the teacher approves it into a payment. */
export const receipts = pgTable(
  "receipts",
  {
    id: id(),
    teacherId: uuid()
      .notNull()
      .references(() => teachers.id, { onDelete: "restrict" }),
    studentId: uuid()
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
    invoiceId: uuid()
      .notNull()
      .references(() => invoices.id, { onDelete: "restrict" }),
    fileId: uuid()
      .notNull()
      .references(() => files.id, { onDelete: "restrict" }),
    amountToman: bigint({ mode: "number" }).notNull(),
    cardLast4: text(),
    status: receiptStatusEnum().notNull().default("pending"),
    rejectReason: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index().on(t.teacherId, t.status), index().on(t.invoiceId)],
);

/** A learner's running credit: positive rows add (a move, an overpayment), negative rows spend it. */
export const studentCredits = pgTable(
  "student_credits",
  {
    id: id(),
    teacherId: uuid()
      .notNull()
      .references(() => teachers.id, { onDelete: "restrict" }),
    studentId: uuid()
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
    amountToman: bigint({ mode: "number" }).notNull(),
    reason: creditReasonEnum().notNull(),
    note: text(),
    /** The invoice that spent the credit, or the payment's invoice for an overpayment. */
    invoiceId: uuid().references(() => invoices.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.studentId)],
);

/** One row per teacher: the card learners pay to, and the billing rules. */
export const paymentSettings = pgTable(
  "payment_settings",
  {
    teacherId: uuid()
      .primaryKey()
      .references(() => teachers.id, { onDelete: "cascade" }),
    cardNumber: text(),
    cardHolder: text(),
    sheba: text(),
    dueDays: smallint().notNull().default(7),
    graceDays: smallint().notNull().default(3),
    /** Moves round the proposed credit to this many Toman. */
    roundTo: integer().notNull().default(1000),
    /** On: drafts are issued the moment they are made. */
    autoIssue: boolean().notNull().default(false),
    smsBefore: boolean().notNull().default(true),
    smsOverdue: boolean().notNull().default(true),
    smsApproved: boolean().notNull().default(true),
    smsRejected: boolean().notNull().default(true),
    smsManual: boolean().notNull().default(false),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    check("payment_settings_due_check", sql`${t.dueDays} between 1 and 60`),
    check("payment_settings_grace_check", sql`${t.graceDays} between 0 and 30`),
    check("payment_settings_round_check", sql`${t.roundTo} in (1000, 10000)`),
  ],
);

/** Every SMS we tried to send. `dedupeKey` makes reminders go out once. */
export const smsMessages = pgTable(
  "sms_messages",
  {
    id: id(),
    teacherId: uuid()
      .notNull()
      .references(() => teachers.id, { onDelete: "cascade" }),
    studentId: uuid().references(() => students.id, { onDelete: "set null" }),
    phone: text().notNull(),
    kind: text().notNull(),
    body: text().notNull(),
    status: smsStatusEnum().notNull(),
    error: text(),
    dedupeKey: text().unique(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.teacherId, t.createdAt)],
);
