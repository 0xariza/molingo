import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  invoiceLines,
  invoices,
  payments,
  paymentSettings,
  receipts,
  sessions,
  attendance,
  billingExemptions,
  classes,
} from "@/db/schema";
import { jalaliMonthKey } from "@/lib/format";
import { listInvoiceRows, type InvoiceRow } from "./reports";

export type LineView = {
  id: string;
  kind: "session" | "course_fee" | "adjustment" | "credit";
  description: string;
  amount: number;
  sessionId: string | null;
  startsAt: Date | null;
};

/** A monthly invoice's session that is not charged, and why. */
export type SkippedSession = {
  id: string;
  startsAt: Date;
  why: "cancelled" | "excused" | "exempt";
};

export type InvoiceDetail = {
  row: InvoiceRow;
  shortCode: string;
  price: number;
  lines: LineView[];
  skipped: SkippedSession[];
  payments: {
    id: string;
    paidOn: string;
    amount: number;
    method: string;
    reference: string | null;
  }[];
  receipts: {
    id: string;
    amount: number;
    status: "pending" | "approved" | "rejected";
    rejectReason: string | null;
    fileId: string;
    createdAt: Date;
  }[];
  card: { number: string | null; holder: string | null; sheba: string | null };
  teacherId: string;
};

/** One invoice as its teacher or its learner sees it. Pass the owner's ids; null when it isn't theirs. */
export async function invoiceDetail(
  id: string,
  owner: { teacherId: string } | { studentId: string },
  now: Date,
): Promise<InvoiceDetail | null> {
  const [head] = await db
    .select({
      teacherId: invoices.teacherId,
      studentId: invoices.studentId,
      classId: invoices.classId,
      status: invoices.status,
      shortCode: invoices.shortCode,
      price: classes.priceToman,
      period: invoices.period,
    })
    .from(invoices)
    .innerJoin(classes, eq(classes.id, invoices.classId))
    .where(eq(invoices.id, id));
  if (!head) return null;
  if (
    "teacherId" in owner ? head.teacherId !== owner.teacherId : head.studentId !== owner.studentId
  ) {
    return null;
  }
  // A learner never sees a draft or a voided invoice.
  if ("studentId" in owner && head.status !== "issued") return null;

  const [[row], lines, pays, recs, [settings]] = await Promise.all([
    listInvoiceRows(head.teacherId, now, { ids: [id] }),
    db
      .select({
        id: invoiceLines.id,
        kind: invoiceLines.kind,
        description: invoiceLines.description,
        amount: invoiceLines.amountToman,
        sessionId: invoiceLines.sessionId,
        startsAt: sessions.startsAt,
      })
      .from(invoiceLines)
      .leftJoin(sessions, eq(sessions.id, invoiceLines.sessionId))
      .where(eq(invoiceLines.invoiceId, id))
      .orderBy(asc(sessions.startsAt), asc(invoiceLines.createdAt)),
    db
      .select({
        id: payments.id,
        paidOn: payments.paidOn,
        amount: payments.amountToman,
        method: payments.method,
        reference: payments.reference,
      })
      .from(payments)
      .where(eq(payments.invoiceId, id))
      .orderBy(asc(payments.paidOn)),
    db
      .select({
        id: receipts.id,
        amount: receipts.amountToman,
        status: receipts.status,
        rejectReason: receipts.rejectReason,
        fileId: receipts.fileId,
        createdAt: receipts.createdAt,
      })
      .from(receipts)
      .where(eq(receipts.invoiceId, id))
      .orderBy(asc(receipts.createdAt)),
    db.select().from(paymentSettings).where(eq(paymentSettings.teacherId, head.teacherId)),
  ]);

  // Month sessions that aren't on the invoice: the teacher sees why, to be able to charge them.
  const charged = new Set(lines.map((l) => l.sessionId));
  const skipped: SkippedSession[] = [];
  if (head.period && "teacherId" in owner) {
    const held = await db
      .select({ id: sessions.id, startsAt: sessions.startsAt, status: sessions.status })
      .from(sessions)
      .where(eq(sessions.classId, head.classId))
      .orderBy(asc(sessions.startsAt));
    const [excused, exempt] = await Promise.all([
      db
        .select({ id: attendance.sessionId })
        .from(attendance)
        .where(and(eq(attendance.studentId, head.studentId), eq(attendance.status, "excused"))),
      db
        .select({ id: billingExemptions.sessionId })
        .from(billingExemptions)
        .where(eq(billingExemptions.studentId, head.studentId)),
    ]);
    const excusedIds = new Set(excused.map((e) => e.id));
    const exemptIds = new Set(exempt.map((e) => e.id));
    for (const s of held) {
      if (charged.has(s.id) || jalaliMonthKey(s.startsAt) !== head.period) continue;
      if (exemptIds.has(s.id)) skipped.push({ id: s.id, startsAt: s.startsAt, why: "exempt" });
      else if (s.status === "cancelled")
        skipped.push({ id: s.id, startsAt: s.startsAt, why: "cancelled" });
      else if (excusedIds.has(s.id))
        skipped.push({ id: s.id, startsAt: s.startsAt, why: "excused" });
    }
  }

  return {
    row,
    shortCode: head.shortCode,
    price: head.price,
    lines,
    skipped,
    payments: pays,
    receipts: recs,
    card: {
      number: settings?.cardNumber ?? null,
      holder: settings?.cardHolder ?? null,
      sheba: settings?.sheba ?? null,
    },
    teacherId: head.teacherId,
  };
}
