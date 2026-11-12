"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { tehranDateKey } from "@/lib/format";
import { requireStudent, requireTeacher } from "../auth/current";
import { checkUploads, deleteFiles, storeFiles, uploadedFiles } from "../files/storage";
import { fieldErrors, text } from "../forms";
import {
  addAdjustment,
  adjustmentSchema,
  issueInvoices,
  removeAdjustment,
  setExempt,
  voidInvoice,
} from "./invoices";
import { notifyIssued, notifyManualPayment, notifyReceipt, notifyReminder } from "./notify";
import {
  addPrice,
  approveReceipt,
  paymentSchema,
  priceSchema,
  recordPayment,
  receiptSchema,
  rejectReceipt,
  submitReceipt,
  tomanField,
} from "./payments";
import { REJECT_REASONS } from "./reasons";
import { saveSettings, settingsSchema } from "./settings";
import { studentOf } from "./learner";

/** Error keys map to messages under `Admin.finance.errors` / `Student.bills.errors`. */
export type BillingFormState = {
  status: "idle" | "error" | "success";
  error?: string;
  fieldErrors?: Record<string, string>;
};

const bool = (form: FormData, key: string) => form.get(key) === "on";
const done = (): BillingFormState => {
  refresh();
  return { status: "success" };
};

/** Issues the ticked drafts and texts each learner. */
export async function issueInvoicesAction(
  _: BillingFormState,
  form: FormData,
): Promise<BillingFormState> {
  const { teacherId } = await requireTeacher();
  const ids = z.array(z.uuid()).safeParse(form.getAll("ids").map(String));
  if (!ids.success || !ids.data.length) return { status: "error", error: "none" };
  const issued = await issueInvoices(teacherId, ids.data);
  for (const id of issued) await notifyIssued(id);
  return done();
}

export async function voidInvoiceAction(
  _: BillingFormState,
  form: FormData,
): Promise<BillingFormState> {
  const { teacherId } = await requireTeacher();
  const id = z.uuid().safeParse(text(form, "id"));
  if (!id.success) return { status: "error", error: "not_found" };
  const result = await voidInvoice(teacherId, id.data);
  return result.ok ? done() : { status: "error", error: result.error };
}

export async function addAdjustmentAction(
  _: BillingFormState,
  form: FormData,
): Promise<BillingFormState> {
  const { teacherId } = await requireTeacher();
  const amount = tomanField.safeParse(text(form, "amount"));
  const parsed = adjustmentSchema.safeParse({
    invoiceId: text(form, "invoiceId"),
    description: text(form, "description"),
    amount: amount.success ? amount.data * (text(form, "sign") === "plus" ? 1 : -1) : NaN,
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error.issues) };
  const result = await addAdjustment(teacherId, parsed.data);
  return result.ok ? done() : { status: "error", error: result.error };
}

export async function removeAdjustmentAction(form: FormData): Promise<void> {
  const { teacherId } = await requireTeacher();
  const ids = z.object({ invoiceId: z.uuid(), lineId: z.uuid() }).safeParse({
    invoiceId: text(form, "invoiceId"),
    lineId: text(form, "lineId"),
  });
  if (ids.success) await removeAdjustment(teacherId, ids.data.invoiceId, ids.data.lineId);
  refresh();
}

export async function setExemptAction(form: FormData): Promise<void> {
  const { teacherId } = await requireTeacher();
  const ids = z.object({ invoiceId: z.uuid(), sessionId: z.uuid() }).safeParse({
    invoiceId: text(form, "invoiceId"),
    sessionId: text(form, "sessionId"),
  });
  if (ids.success) {
    await setExempt(
      teacherId,
      ids.data.invoiceId,
      ids.data.sessionId,
      text(form, "exempt") === "on",
    );
  }
  refresh();
}

export async function recordPaymentAction(
  _: BillingFormState,
  form: FormData,
): Promise<BillingFormState> {
  const { teacherId } = await requireTeacher();
  const parsed = paymentSchema.safeParse({
    studentId: text(form, "studentId"),
    invoiceId: text(form, "invoiceId") || undefined,
    amount: text(form, "amount"),
    paidOn: text(form, "paidOn"),
    method: text(form, "method"),
    reference: text(form, "reference"),
    note: text(form, "note"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error.issues) };
  const result = await recordPayment(teacherId, parsed.data);
  if (!result.ok) return { status: "error", error: result.error };
  if (bool(form, "sms"))
    await notifyManualPayment(teacherId, parsed.data.studentId, parsed.data.amount);
  return done();
}

export async function approveReceiptAction(
  _: BillingFormState,
  form: FormData,
): Promise<BillingFormState> {
  const { teacherId } = await requireTeacher();
  const parsed = z
    .object({ id: z.uuid(), amount: tomanField })
    .safeParse({ id: text(form, "id"), amount: text(form, "amount") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error.issues) };
  const result = await approveReceipt(
    teacherId,
    parsed.data.id,
    parsed.data.amount,
    tehranDateKey(new Date()),
  );
  if (!result.ok) return { status: "error", error: result.error };
  await notifyReceipt(parsed.data.id, "approved");
  return done();
}

export async function rejectReceiptAction(
  _: BillingFormState,
  form: FormData,
): Promise<BillingFormState> {
  const { teacherId } = await requireTeacher();
  const parsed = z
    .object({ id: z.uuid(), reason: z.enum(REJECT_REASONS) })
    .safeParse({ id: text(form, "id"), reason: text(form, "reason") });
  if (!parsed.success) return { status: "error", error: "reason" };
  const result = await rejectReceipt(teacherId, parsed.data.id, parsed.data.reason);
  if (!result.ok) return { status: "error", error: result.error };
  await notifyReceipt(parsed.data.id, "rejected");
  return done();
}

/** The "remind" button on an overdue invoice: once per day. */
export async function remindAction(form: FormData): Promise<void> {
  const { teacherId } = await requireTeacher();
  const id = z.uuid().safeParse(text(form, "id"));
  if (id.success) {
    const [own] = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(and(eq(invoices.id, id.data), eq(invoices.teacherId, teacherId)));
    if (own) await notifyReminder(own.id, "overdue", `manual:${tehranDateKey(new Date())}`, true);
  }
  refresh();
}

export async function saveSettingsAction(
  _: BillingFormState,
  form: FormData,
): Promise<BillingFormState> {
  const { teacherId } = await requireTeacher();
  const parsed = settingsSchema.safeParse({
    cardNumber: text(form, "cardNumber"),
    cardHolder: text(form, "cardHolder"),
    sheba: text(form, "sheba"),
    dueDays: text(form, "dueDays"),
    graceDays: text(form, "graceDays"),
    roundTo: text(form, "roundTo"),
    autoIssue: bool(form, "autoIssue"),
    smsBefore: bool(form, "smsBefore"),
    smsOverdue: bool(form, "smsOverdue"),
    smsApproved: bool(form, "smsApproved"),
    smsRejected: bool(form, "smsRejected"),
    smsManual: bool(form, "smsManual"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error.issues) };
  await saveSettings(teacherId, parsed.data);
  return done();
}

export async function addPriceAction(
  _: BillingFormState,
  form: FormData,
): Promise<BillingFormState> {
  const { teacherId } = await requireTeacher();
  const parsed = priceSchema.safeParse({
    classId: text(form, "classId"),
    price: text(form, "price"),
    effectiveFrom: text(form, "effectiveFrom"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error.issues) };
  const result = await addPrice(teacherId, parsed.data);
  return result.ok ? done() : { status: "error", error: result.error };
}

/** The learner's receipt photo, amount and card digits. */
export async function submitReceiptAction(
  _: BillingFormState,
  form: FormData,
): Promise<BillingFormState> {
  const user = await requireStudent();
  const parsed = receiptSchema.safeParse({
    invoiceId: text(form, "invoiceId"),
    amount: text(form, "amount"),
    cardLast4: text(form, "cardLast4"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error.issues) };
  const [photo, ...extra] = uploadedFiles(form, "photo");
  if (!photo || extra.length) return { status: "error", error: "photo" };
  const bad = checkUploads([photo]);
  if (bad || !photo.type.startsWith("image/"))
    return { status: "error", error: bad ?? "file_type" };

  const studentId = await studentOf(user.id);
  if (!studentId) return { status: "error", error: "not_found" };
  const [fileId] = await storeFiles(user.id, [photo]);
  const result = await submitReceipt(studentId, fileId, parsed.data);
  if (!result.ok) {
    await deleteFiles([fileId]);
    return { status: "error", error: result.error };
  }
  return done();
}
