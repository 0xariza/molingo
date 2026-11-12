import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { invoiceLines, invoices, payments, receipts, students, teachers } from "@/db/schema";
import { formatDate, formatNumber, fromTehranTime } from "@/lib/format";
import { jalaliMonthLabel } from "./pricing";
import { getSettings } from "./settings";
import { sendSms } from "./sms";

const toman = (n: number) => `${formatNumber(n, "fa")} تومان`;

type Context = {
  teacherId: string;
  studentId: string;
  phone: string;
  brand: string;
  kind: "monthly" | "course";
  period: string | null;
  shortCode: string;
  dueOn: string | null;
  left: number;
  total: number;
};

async function context(invoiceId: string): Promise<Context | null> {
  const [row] = await db
    .select({
      teacherId: invoices.teacherId,
      studentId: invoices.studentId,
      phone: students.phone,
      brand: teachers.brandName,
      kind: invoices.kind,
      period: invoices.period,
      shortCode: invoices.shortCode,
      dueOn: invoices.dueOn,
      total: sql<string>`(select coalesce(sum(amount_toman), 0) from ${invoiceLines} where invoice_id = ${invoices.id})`,
      paid: sql<string>`(select coalesce(sum(amount_toman), 0) from ${payments} where invoice_id = ${invoices.id})`,
    })
    .from(invoices)
    .innerJoin(students, eq(students.id, invoices.studentId))
    .innerJoin(teachers, eq(teachers.id, invoices.teacherId))
    .where(eq(invoices.id, invoiceId));
  if (!row) return null;
  const total = Number(row.total);
  return { ...row, total, left: Math.max(0, total - Number(row.paid)) };
}

const link = (c: Context) => `${process.env.APP_URL ?? "https://hoopo.ir"}/b/${c.shortCode}`;
const what = (c: Context) =>
  c.period ? `صورتحساب ${jalaliMonthLabel(c.period, "fa")}` : "شهریه‌ی دوره";
const due = (c: Context) =>
  formatDate(fromTehranTime(c.dueOn!, "12:00"), "fa", { weekday: false, year: false });

/** The SMS that goes with issuing; always sent. */
export async function notifyIssued(invoiceId: string) {
  const c = await context(invoiceId);
  if (!c) return;
  await sendSms({
    teacherId: c.teacherId,
    studentId: c.studentId,
    phone: c.phone,
    kind: "issued",
    body: `${c.brand}: ${what(c)} شما ${toman(c.total)} صادر شد. مهلت ${due(c)}. ${link(c)}`,
  });
}

export async function notifyReceipt(receiptId: string, outcome: "approved" | "rejected") {
  const [r] = await db
    .select({
      invoiceId: receipts.invoiceId,
      amount: receipts.amountToman,
      reason: receipts.rejectReason,
    })
    .from(receipts)
    .where(eq(receipts.id, receiptId));
  const c = r && (await context(r.invoiceId));
  if (!c) return;
  const settings = await getSettings(db, c.teacherId);
  if (outcome === "approved" ? !settings.smsApproved : !settings.smsRejected) return;
  const reasons = {
    amount: "مبلغ با واریزی نمی‌خواند",
    unreadable: "رسید خوانا نیست",
    not_received: "واریزی به حساب نرسیده",
  } as const;
  await sendSms({
    teacherId: c.teacherId,
    studentId: c.studentId,
    phone: c.phone,
    kind: `receipt_${outcome}`,
    body:
      outcome === "approved"
        ? `${c.brand}: پرداخت ${toman(r.amount)} شما ثبت شد. ممنون!`
        : `${c.brand}: رسیدتان تأیید نشد: ${reasons[r.reason as keyof typeof reasons] ?? ""}. دوباره بفرستید: ${link(c)}`,
  });
}

export async function notifyManualPayment(teacherId: string, studentId: string, amount: number) {
  if (!(await getSettings(db, teacherId)).smsManual) return;
  const [row] = await db
    .select({ phone: students.phone, brand: teachers.brandName })
    .from(students)
    .innerJoin(teachers, eq(teachers.id, teacherId))
    .where(eq(students.id, studentId));
  if (!row) return;
  await sendSms({
    teacherId,
    studentId,
    phone: row.phone,
    kind: "manual_payment",
    body: `${row.brand}: پرداخت ${toman(amount)} شما ثبت شد.`,
  });
}

/** Reminder before the due date and after it; `key` makes each go out once. */
export async function notifyReminder(
  invoiceId: string,
  kind: "before" | "overdue",
  key: string,
  force = false,
) {
  const c = await context(invoiceId);
  if (!c || c.left <= 0) return;
  const settings = await getSettings(db, c.teacherId);
  if (!force && (kind === "before" ? !settings.smsBefore : !settings.smsOverdue)) return;
  await sendSms({
    teacherId: c.teacherId,
    studentId: c.studentId,
    phone: c.phone,
    kind,
    dedupeKey: `${kind}:${invoiceId}:${key}`,
    body:
      kind === "before"
        ? `${c.brand}: ۲ روز تا مهلت ${what(c)} (${toman(c.left)}) مانده. ${link(c)}`
        : `${c.brand}: مهلت ${what(c)} گذشته. مانده ${toman(c.left)}. ${link(c)}`,
  });
}
