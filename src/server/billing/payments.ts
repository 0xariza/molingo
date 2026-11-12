import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, type Db } from "@/db";
import {
  classPrices,
  classes,
  invoices,
  payments,
  receipts,
  sessions,
  studentCredits,
} from "@/db/schema";
import { toLatinDigits } from "@/lib/format";
import { invoiceTotal } from "./invoices";
import { REJECT_REASONS } from "./reasons";
import { getSettings } from "./settings";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** "۴٬۵۵۰٬۰۰۰", "4,550,000" → 4550000; NaN when it isn't a whole number. */
export const tomanField = z
  .string()
  .transform((v) => Number(toLatinDigits(v).replace(/[\s,٬،]/g, "")))
  .pipe(z.number("amount").int("amount").positive("amount"));

export const paymentSchema = z.object({
  studentId: z.string().uuid(),
  /** Empty = no invoice: the money becomes the learner's credit. */
  invoiceId: z.string().uuid().optional(),
  amount: tomanField,
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date"),
  method: z.enum(["card", "cash", "bank", "other"]),
  reference: z.string().trim().max(60).optional(),
  note: z.string().trim().max(200).optional(),
});
export type PaymentInput = z.infer<typeof paymentSchema>;

export type PaymentError = "not_found" | "void" | "draft";

/** What an invoice has received so far. */
export async function paidOn(exec: Pick<Db, "select">, invoiceId: string): Promise<number> {
  const [row] = await exec
    .select({ n: sql<string>`coalesce(sum(${payments.amountToman}), 0)` })
    .from(payments)
    .where(eq(payments.invoiceId, invoiceId));
  return Number(row.n);
}

/**
 * Records money received. What the invoice still owes is paid off; anything beyond that (or a
 * payment with no invoice) is kept as the learner's credit and spent on the next invoice.
 */
export async function recordPayment(
  teacherId: string,
  input: PaymentInput,
  receiptId?: string,
  exec?: Tx,
): Promise<{ ok: true; paymentId: string } | { ok: false; error: PaymentError }> {
  const run = async (tx: Tx) => {
    let applied = 0;
    if (input.invoiceId) {
      const [inv] = await tx
        .select({ status: invoices.status, studentId: invoices.studentId })
        .from(invoices)
        .where(and(eq(invoices.id, input.invoiceId), eq(invoices.teacherId, teacherId)))
        .for("update");
      if (!inv || inv.studentId !== input.studentId)
        return { ok: false as const, error: "not_found" as const };
      if (inv.status === "void") return { ok: false as const, error: "void" as const };
      if (inv.status === "draft") return { ok: false as const, error: "draft" as const };
      const left = (await invoiceTotal(tx, input.invoiceId)) - (await paidOn(tx, input.invoiceId));
      applied = Math.max(0, Math.min(input.amount, left));
    }
    const base = {
      teacherId,
      studentId: input.studentId,
      paidOn: input.paidOn,
      method: input.method,
      reference: input.reference || null,
      note: input.note || null,
    };
    let paymentId = "";
    if (applied > 0) {
      const [p] = await tx
        .insert(payments)
        .values({ ...base, invoiceId: input.invoiceId, amountToman: applied, receiptId })
        .returning({ id: payments.id });
      paymentId = p.id;
    }
    const extra = input.amount - applied;
    if (extra > 0) {
      const [p] = await tx
        .insert(payments)
        .values({ ...base, amountToman: extra, receiptId: applied > 0 ? undefined : receiptId })
        .returning({ id: payments.id });
      paymentId ||= p.id;
      await tx.insert(studentCredits).values({
        teacherId,
        studentId: input.studentId,
        amountToman: extra,
        reason: "overpayment",
        invoiceId: input.invoiceId,
      });
    }
    return { ok: true as const, paymentId };
  };
  return exec ? run(exec) : db.transaction(run);
}

export const receiptSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: tomanField,
  cardLast4: z
    .string()
    .transform((v) => toLatinDigits(v).trim())
    .refine((v) => v === "" || /^\d{4}$/.test(v), "last4"),
});

export type ReceiptError = "not_found" | "not_open" | "already_pending";

/** The learner's proof of transfer; `fileId` is already stored. */
export async function submitReceipt(
  studentId: string,
  fileId: string,
  input: z.infer<typeof receiptSchema>,
): Promise<{ ok: true; id: string } | { ok: false; error: ReceiptError }> {
  return db.transaction(async (tx) => {
    const [inv] = await tx
      .select({ teacherId: invoices.teacherId, status: invoices.status })
      .from(invoices)
      .where(and(eq(invoices.id, input.invoiceId), eq(invoices.studentId, studentId)))
      .for("update");
    if (!inv) return { ok: false, error: "not_found" };
    const left = (await invoiceTotal(tx, input.invoiceId)) - (await paidOn(tx, input.invoiceId));
    if (inv.status !== "issued" || left <= 0) return { ok: false, error: "not_open" };
    const [pending] = await tx
      .select({ id: receipts.id })
      .from(receipts)
      .where(and(eq(receipts.invoiceId, input.invoiceId), eq(receipts.status, "pending")));
    if (pending) return { ok: false, error: "already_pending" };
    const [row] = await tx
      .insert(receipts)
      .values({
        teacherId: inv.teacherId,
        studentId,
        invoiceId: input.invoiceId,
        fileId,
        amountToman: input.amount,
        cardLast4: input.cardLast4 || null,
      })
      .returning({ id: receipts.id });
    return { ok: true, id: row.id };
  });
}

export type DecisionError = "not_found" | "decided" | PaymentError;

/** Approving turns the receipt into a payment, at the amount the teacher saw arrive. */
export async function approveReceipt(
  teacherId: string,
  receiptId: string,
  amount: number,
  today: string,
): Promise<
  | { ok: true; studentId: string; invoiceId: string; amount: number }
  | { ok: false; error: DecisionError }
> {
  return db.transaction(async (tx) => {
    const [r] = await tx
      .select()
      .from(receipts)
      .where(and(eq(receipts.id, receiptId), eq(receipts.teacherId, teacherId)))
      .for("update");
    if (!r) return { ok: false, error: "not_found" };
    if (r.status !== "pending") return { ok: false, error: "decided" };
    const paid = await recordPayment(
      teacherId,
      {
        studentId: r.studentId,
        invoiceId: r.invoiceId,
        amount,
        paidOn: today,
        method: "card",
        reference: r.cardLast4 ? `•••• ${r.cardLast4}` : undefined,
      },
      r.id,
      tx,
    );
    if (!paid.ok) return paid;
    await tx
      .update(receipts)
      .set({ status: "approved", decidedAt: new Date() })
      .where(eq(receipts.id, r.id));
    return { ok: true, studentId: r.studentId, invoiceId: r.invoiceId, amount };
  });
}

export async function rejectReceipt(
  teacherId: string,
  receiptId: string,
  reason: (typeof REJECT_REASONS)[number],
): Promise<
  { ok: true; studentId: string; invoiceId: string } | { ok: false; error: "not_found" | "decided" }
> {
  const rows = await db
    .update(receipts)
    .set({ status: "rejected", rejectReason: reason, decidedAt: new Date() })
    .where(
      and(
        eq(receipts.id, receiptId),
        eq(receipts.teacherId, teacherId),
        eq(receipts.status, "pending"),
      ),
    )
    .returning({ studentId: receipts.studentId, invoiceId: receipts.invoiceId });
  if (rows.length) return { ok: true, ...rows[0] };
  const [exists] = await db
    .select({ id: receipts.id })
    .from(receipts)
    .where(and(eq(receipts.id, receiptId), eq(receipts.teacherId, teacherId)));
  return { ok: false, error: exists ? "decided" : "not_found" };
}

export const priceSchema = z.object({
  classId: z.string().uuid(),
  price: tomanField,
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date"),
});

/** A new per-session price from a date; a second change on the same date replaces the first. */
export async function addPrice(
  teacherId: string,
  input: z.infer<typeof priceSchema>,
): Promise<{ ok: true } | { ok: false; error: "not_found" | "not_private" }> {
  const [cls] = await db
    .select({ type: classes.type })
    .from(classes)
    .where(and(eq(classes.id, input.classId), eq(classes.teacherId, teacherId)));
  if (!cls) return { ok: false, error: "not_found" };
  if (cls.type !== "private") return { ok: false, error: "not_private" };
  await db
    .insert(classPrices)
    .values({
      classId: input.classId,
      priceToman: input.price,
      effectiveFrom: input.effectiveFrom,
    })
    .onConflictDoUpdate({
      target: [classPrices.classId, classPrices.effectiveFrom],
      set: { priceToman: input.price },
    });
  return { ok: true };
}

/**
 * What a learner moving out of a group class has already paid for sessions that won't happen:
 * the fee paid, scaled by the share of sessions still to come, rounded down to the teacher's step.
 */
export async function moveCreditProposal(teacherId: string, classId: string, studentId: string) {
  const [cls] = await db
    .select({ total: classes.sessionCount })
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.teacherId, teacherId)));
  if (!cls) return null;
  const [left] = await db
    .select({ n: sql<string>`count(*)` })
    .from(sessions)
    .where(and(eq(sessions.classId, classId), eq(sessions.status, "scheduled")));
  const [paid] = await db
    .select({ n: sql<string>`coalesce(sum(${payments.amountToman}), 0)` })
    .from(payments)
    .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
    .where(
      and(
        eq(invoices.classId, classId),
        eq(invoices.studentId, studentId),
        eq(invoices.kind, "course"),
      ),
    );
  const { roundTo } = await getSettings(db, teacherId);
  const remaining = Number(left.n);
  const paidToman = Number(paid.n);
  const suggested = Math.floor((paidToman * remaining) / cls.total / roundTo) * roundTo;
  return { paid: paidToman, total: cls.total, remaining, past: cls.total - remaining, suggested };
}

/** Gives the learner credit; it comes off their next invoice. */
export async function grantCredit(
  tx: Tx,
  teacherId: string,
  studentId: string,
  amount: number,
  reason: "move",
) {
  if (amount <= 0) return;
  await tx.insert(studentCredits).values({ teacherId, studentId, amountToman: amount, reason });
}
