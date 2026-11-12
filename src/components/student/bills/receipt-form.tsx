"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { ErrorAlert } from "@/components/ui/alert";
import { fieldErrorKey } from "@/components/admin/finance/forms";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { submitReceiptAction, type BillingFormState } from "@/server/billing/actions";

const initial: BillingFormState = { status: "idle" };

/** Step 2 of paying: the bank screenshot, the amount sent, and the last four digits of the card. */
export function ReceiptForm({ invoiceId, left }: { invoiceId: string; left: number }) {
  const t = useTranslations("Student.bills");
  const tf = useTranslations("Admin.finance.fieldErrors");
  const [state, action] = useActionState(submitReceiptAction, initial);
  const err = (k: string) =>
    state.fieldErrors?.[k] ? tf(fieldErrorKey(state.fieldErrors[k])) : undefined;
  return (
    <form action={action} className="space-y-4">
      {state.error && <ErrorAlert>{t(`errors.${state.error as "photo"}`)}</ErrorAlert>}
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <label className="block space-y-1.5">
        <span className="block text-sm font-bold text-ocean">{t("photo")}</span>
        <input
          type="file"
          name="photo"
          accept="image/jpeg,image/png,image/webp"
          required
          className="block min-h-touch w-full rounded-2xl border-2 border-dashed border-teal bg-white p-3 text-brand"
        />
      </label>
      <Field
        label={t("amount")}
        name="amount"
        inputMode="numeric"
        dir="ltr"
        defaultValue={String(left)}
        hint={t("amountHint")}
        error={err("amount")}
      />
      <Field
        label={t("last4")}
        name="cardLast4"
        inputMode="numeric"
        maxLength={4}
        dir="ltr"
        placeholder="0000"
        error={err("cardLast4")}
      />
      <SubmitButton pendingLabel={t("sending")}>{t("send")}</SubmitButton>
    </form>
  );
}
