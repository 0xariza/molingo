import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  classes,
  invoiceLines,
  invoices,
  payments,
  receipts,
  students,
  studentCredits,
} from "@/db/schema";
import { jalaliMonthKey, tehranDateKey, fromTehranTime } from "@/lib/format";
import { invoiceState, type InvoiceState } from "./pricing";
import { getSettings } from "./settings";

export type InvoiceRow = {
  id: string;
  number: number;
  kind: "monthly" | "course";
  period: string | null;
  status: "draft" | "issued" | "void";
  studentId: string;
  fullNameFa: string;
  fullNameEn: string | null;
  classId: string;
  classFa: string;
  classEn: string | null;
  total: number;
  paid: number;
  left: number;
  dueOn: string | null;
  issuedAt: Date | null;
  createdAt: Date;
  pendingReceipts: number;
  state: InvoiceState;
  partial: boolean;
};

/** A teacher's invoices with their money and state, newest first. */
export async function listInvoiceRows(
  teacherId: string,
  now: Date,
  where?: { studentId?: string; ids?: string[] },
): Promise<InvoiceRow[]> {
  const { graceDays } = await getSettings(db, teacherId);
  const today = tehranDateKey(now);
  const rows = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      kind: invoices.kind,
      period: invoices.period,
      status: invoices.status,
      studentId: invoices.studentId,
      fullNameFa: students.fullNameFa,
      fullNameEn: students.fullNameEn,
      classId: invoices.classId,
      classFa: classes.nameFa,
      classEn: classes.nameEn,
      dueOn: invoices.dueOn,
      issuedAt: invoices.issuedAt,
      createdAt: invoices.createdAt,
      total: sql<string>`(select coalesce(sum(l.amount_toman), 0) from ${invoiceLines} l where l.invoice_id = ${invoices.id})`,
      paid: sql<string>`(select coalesce(sum(p.amount_toman), 0) from ${payments} p where p.invoice_id = ${invoices.id})`,
      pendingReceipts: sql<string>`(select count(*) from ${receipts} r where r.invoice_id = ${invoices.id} and r.status = 'pending')`,
    })
    .from(invoices)
    .innerJoin(students, eq(students.id, invoices.studentId))
    .innerJoin(classes, eq(classes.id, invoices.classId))
    .where(
      and(
        eq(invoices.teacherId, teacherId),
        where?.studentId ? eq(invoices.studentId, where.studentId) : undefined,
        where?.ids ? inArray(invoices.id, where.ids) : undefined,
      ),
    )
    .orderBy(desc(invoices.createdAt));
  return rows.map((r) => {
    const total = Number(r.total);
    const paid = Number(r.paid);
    const s = invoiceState({ status: r.status, total, paid, dueOn: r.dueOn }, graceDays, today);
    return {
      ...r,
      total,
      paid,
      pendingReceipts: Number(r.pendingReceipts),
      state: s.state,
      partial: s.partial,
      left: s.left,
    };
  });
}

export type PaymentRow = {
  id: string;
  paidOn: string;
  amount: number;
  method: "card" | "cash" | "bank" | "other";
  hasReceipt: boolean;
  studentId: string;
  fullNameFa: string;
  fullNameEn: string | null;
  invoiceId: string | null;
  note: string | null;
};

export async function listPayments(teacherId: string, studentId?: string): Promise<PaymentRow[]> {
  const rows = await db
    .select({
      id: payments.id,
      paidOn: payments.paidOn,
      amount: payments.amountToman,
      method: payments.method,
      receiptId: payments.receiptId,
      studentId: payments.studentId,
      fullNameFa: students.fullNameFa,
      fullNameEn: students.fullNameEn,
      invoiceId: payments.invoiceId,
      note: payments.note,
    })
    .from(payments)
    .innerJoin(students, eq(students.id, payments.studentId))
    .where(
      and(
        eq(payments.teacherId, teacherId),
        studentId ? eq(payments.studentId, studentId) : undefined,
      ),
    )
    .orderBy(desc(payments.paidOn), desc(payments.createdAt));
  return rows.map(({ receiptId, ...r }) => ({ ...r, hasReceipt: receiptId !== null }));
}

/** Toman received per Jalali month, from the payments' own dates. */
export function incomeByMonth(rows: PaymentRow[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of rows) {
    const key = jalaliMonthKey(fromTehranTime(p.paidOn, "12:00"));
    out.set(key, (out.get(key) ?? 0) + p.amount);
  }
  return out;
}

export async function creditsByLearner(teacherId: string): Promise<Map<string, number>> {
  const rows = await db
    .select({ id: studentCredits.studentId, n: sql<string>`sum(${studentCredits.amountToman})` })
    .from(studentCredits)
    .where(eq(studentCredits.teacherId, teacherId))
    .groupBy(studentCredits.studentId);
  return new Map(
    rows.map((r) => [r.id, Number(r.n)]).filter(([, n]) => (n as number) > 0) as [string, number][],
  );
}

export async function pendingReceiptCount(teacherId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<string>`count(*)` })
    .from(receipts)
    .where(and(eq(receipts.teacherId, teacherId), eq(receipts.status, "pending")));
  return Number(row.n);
}
