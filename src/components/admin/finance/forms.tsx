"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { ErrorAlert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Field, SelectField } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { tehranDateKey } from "@/lib/format";
import {
  addAdjustmentAction,
  addPriceAction,
  approveReceiptAction,
  issueInvoicesAction,
  recordPaymentAction,
  rejectReceiptAction,
  saveSettingsAction,
  voidInvoiceAction,
  type BillingFormState,
} from "@/server/billing/actions";
import { REJECT_REASONS } from "@/server/billing/reasons";
import type { PaymentSettings } from "@/server/billing/settings";

const initial: BillingFormState = { status: "idle" };

/** The field-error keys the zod schemas can produce; anything else reads as "required". */
export const FIELD_ERRORS = ["required", "amount", "date", "card", "sheba", "last4"] as const;
export type FieldError = (typeof FIELD_ERRORS)[number];
export const fieldErrorKey = (e: string): FieldError =>
  FIELD_ERRORS.find((k) => k === e) ?? "required";

function Errors({ state }: { state: BillingFormState }) {
  const t = useTranslations("Admin.finance.errors");
  return state.error ? <ErrorAlert>{t(state.error as "none")}</ErrorAlert> : null;
}

const fe = (state: BillingFormState, key: string) => {
  const e = state.fieldErrors?.[key];
  return e;
};

function useFieldError(state: BillingFormState) {
  const t = useTranslations("Admin.finance.fieldErrors");
  return (key: string) => {
    const e = fe(state, key);
    return e ? t(fieldErrorKey(e)) : undefined;
  };
}

/** Wraps the ticked draft rows: one button issues them all and texts each learner. */
export function IssueForm({
  children,
  count,
  total,
}: {
  children: React.ReactNode;
  count: number;
  total: string;
}) {
  const t = useTranslations("Admin.finance");
  const [state, action] = useActionState(issueInvoicesAction, initial);
  return (
    <form action={action} className="space-y-4">
      <Errors state={state} />
      {children}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-hairline bg-white p-4">
        <div>
          <p className="font-bold text-ocean">{t("invoices.selected", { count, total })}</p>
          <p className="text-sm">{t("invoices.issueHint")}</p>
        </div>
        <SubmitButton
          pendingLabel={t("invoices.issuing")}
          className="w-full sm:w-auto"
          blocked={count === 0}
        >
          {t("invoices.issue")}
        </SubmitButton>
      </div>
    </form>
  );
}

export function IssueOneForm({ id }: { id: string }) {
  const t = useTranslations("Admin.finance");
  const [state, action] = useActionState(issueInvoicesAction, initial);
  return (
    <form action={action} className="space-y-2">
      <Errors state={state} />
      <input type="hidden" name="ids" value={id} />
      <SubmitButton pendingLabel={t("invoices.issuing")}>{t("invoices.issue")}</SubmitButton>
    </form>
  );
}

export function VoidForm({ id }: { id: string }) {
  const t = useTranslations("Admin.finance.detail");
  const te = useTranslations("Admin.finance");
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(voidInvoiceAction, initial);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClass("quiet", "text-red-700")}
      >
        {t("void")}
      </button>
      {open && (
        <Modal
          title={t("voidTitle")}
          description={t("voidLead")}
          closeLabel={te("close")}
          onClose={() => setOpen(false)}
        >
          <form action={action} className="space-y-4">
            <Errors state={state} />
            <input type="hidden" name="id" value={id} />
            <div className="flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => setOpen(false)} className={buttonClass("ghost")}>
                {te("cancel")}
              </button>
              <SubmitButton
                pendingLabel={t("voiding")}
                variant="danger"
                className="w-full sm:w-auto"
              >
                {t("voidConfirm")}
              </SubmitButton>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

export function AdjustmentForm({ invoiceId }: { invoiceId: string }) {
  const t = useTranslations("Admin.finance.detail");
  const [state, action] = useActionState(addAdjustmentAction, initial);
  const err = useFieldError(state);
  return (
    <form action={action} className="space-y-3 rounded-2xl bg-surface p-4">
      <h3 className="font-bold text-ocean">{t("adjustTitle")}</h3>
      <Errors state={state} />
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <div className="grid gap-3 sm:grid-cols-[1fr_9rem_9rem]">
        <Field label={t("adjustDesc")} name="description" error={err("description")} />
        <Field
          label={t("adjustAmount")}
          name="amount"
          inputMode="numeric"
          dir="ltr"
          error={err("amount")}
        />
        <SelectField
          label={t("adjustSign")}
          name="sign"
          options={[
            { value: "minus", label: t("adjustMinus") },
            { value: "plus", label: t("adjustPlus") },
          ]}
        />
      </div>
      <SubmitButton pendingLabel={t("adding")} variant="ghost" className="w-full sm:w-auto">
        {t("add")}
      </SubmitButton>
    </form>
  );
}

/** Records money received; with no invoice it becomes the learner's credit. */
export function PaymentForm({
  studentId,
  studentName,
  invoiceId,
  left,
  options,
}: {
  studentId: string;
  studentName: string;
  invoiceId?: string;
  left?: string;
  /** The learner's open invoices to pick from, when none is fixed. */
  options?: { value: string; label: string }[];
}) {
  const t = useTranslations("Admin.finance.pay");
  const te = useTranslations("Admin.finance");
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(tehranDateKey(new Date()));
  const [state, action] = useActionState(async (prev: BillingFormState, form: FormData) => {
    const next = await recordPaymentAction(prev, form);
    if (next.status === "success") setOpen(false);
    return next;
  }, initial);
  const err = useFieldError(state);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass("primary")}>
        {t("open")}
      </button>
      {open && (
        <Modal
          title={t("title", { name: studentName })}
          description={left ? t("left", { left }) : t("anyLead")}
          closeLabel={te("close")}
          onClose={() => setOpen(false)}
        >
          <form action={action} className="space-y-4">
            <Errors state={state} />
            <input type="hidden" name="studentId" value={studentId} />
            {invoiceId && <input type="hidden" name="invoiceId" value={invoiceId} />}
            {!invoiceId && options && (
              <SelectField
                label={t("for")}
                name="invoiceId"
                options={[{ value: "", label: t("noInvoice") }, ...options]}
              />
            )}
            <Field
              label={t("amount")}
              name="amount"
              inputMode="numeric"
              dir="ltr"
              error={err("amount")}
            />
            <DatePicker
              label={t("date")}
              name="paidOn"
              value={date}
              onChange={setDate}
              allowed={(k) => k <= tehranDateKey(new Date())}
              placeholder={t("date")}
              error={err("paidOn")}
            />
            <SelectField
              label={t("method")}
              name="method"
              options={(["card", "cash", "bank", "other"] as const).map((m) => ({
                value: m,
                label: t(`methods.${m}`),
              }))}
            />
            <Field label={t("reference")} name="reference" />
            <label className="flex min-h-touch items-center gap-3 font-bold text-ocean">
              <input type="checkbox" name="sms" className="size-5" />
              {t("sms")}
            </label>
            <div className="flex flex-wrap justify-end gap-3 border-t border-mist pt-4">
              <button type="button" onClick={() => setOpen(false)} className={buttonClass("ghost")}>
                {te("cancel")}
              </button>
              <SubmitButton pendingLabel={t("saving")} className="w-full sm:w-auto">
                {t("save")}
              </SubmitButton>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

/** Approve at the amount that reached the account, or reject with a reason that is texted. */
export function ReceiptDecision({ id, amount }: { id: string; amount: number }) {
  const t = useTranslations("Admin.finance.receipts");
  const [rejecting, setRejecting] = useState(false);
  const [approve, approveAction] = useActionState(approveReceiptAction, initial);
  const [reject, rejectAction] = useActionState(rejectReceiptAction, initial);
  const err = useFieldError(approve);
  return (
    <div className="space-y-4">
      {!rejecting ? (
        <form action={approveAction} className="space-y-3">
          <Errors state={approve} />
          <input type="hidden" name="id" value={id} />
          <Field
            label={t("recorded")}
            name="amount"
            inputMode="numeric"
            dir="ltr"
            defaultValue={String(amount)}
            hint={t("recordedHint")}
            error={err("amount")}
          />
          <div className="flex flex-wrap gap-3">
            <SubmitButton pendingLabel={t("approving")} className="w-full sm:w-auto">
              {t("approve")}
            </SubmitButton>
            <button
              type="button"
              onClick={() => setRejecting(true)}
              className={buttonClass("ghost")}
            >
              {t("reject")}
            </button>
          </div>
        </form>
      ) : (
        <form action={rejectAction} className="space-y-3">
          <Errors state={reject} />
          <input type="hidden" name="id" value={id} />
          <fieldset className="space-y-2">
            <legend className="font-bold text-ocean">{t("why")}</legend>
            {REJECT_REASONS.map((r, i) => (
              <label
                key={r}
                className="flex min-h-touch items-center gap-3 rounded-2xl border border-mist bg-white px-3"
              >
                <input
                  type="radio"
                  name="reason"
                  value={r}
                  defaultChecked={i === 0}
                  className="size-5"
                />
                {t(`reasons.${r}`)}
              </label>
            ))}
          </fieldset>
          <div className="flex flex-wrap gap-3">
            <SubmitButton
              pendingLabel={t("rejecting")}
              variant="danger"
              className="w-full sm:w-auto"
            >
              {t("rejectConfirm")}
            </SubmitButton>
            <button
              type="button"
              onClick={() => setRejecting(false)}
              className={buttonClass("ghost")}
            >
              {t("back")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function SettingsForm({ settings }: { settings: PaymentSettings }) {
  const t = useTranslations("Admin.finance.settings");
  const [state, action] = useActionState(saveSettingsAction, initial);
  const err = useFieldError(state);
  const toggles = ["smsBefore", "smsOverdue", "smsApproved", "smsRejected", "smsManual"] as const;
  return (
    <form action={action} className="space-y-6">
      <Errors state={state} />
      {state.status === "success" && (
        <p role="status" className="font-bold text-[#1f7a4d]">
          {t("saved")}
        </p>
      )}
      <section className="space-y-4 rounded-card border border-hairline bg-white p-6">
        <h2 className="font-sans text-lg font-extrabold normal-case tracking-normal">
          {t("cardTitle")}
        </h2>
        <Field
          label={t("cardNumber")}
          name="cardNumber"
          inputMode="numeric"
          dir="ltr"
          defaultValue={settings.cardNumber ?? ""}
          error={err("cardNumber")}
        />
        <Field
          label={t("cardHolder")}
          name="cardHolder"
          defaultValue={settings.cardHolder ?? ""}
          hint={t("cardHolderHint")}
          error={err("cardHolder")}
        />
        <Field
          label={t("sheba")}
          name="sheba"
          dir="ltr"
          defaultValue={settings.sheba ?? ""}
          error={err("sheba")}
        />
      </section>
      <section className="space-y-4 rounded-card border border-hairline bg-white p-6">
        <h2 className="font-sans text-lg font-extrabold normal-case tracking-normal">
          {t("rulesTitle")}
        </h2>
        <SelectField
          label={t("dueDays")}
          name="dueDays"
          defaultValue={String(settings.dueDays)}
          options={[3, 7, 14].map((n) => ({
            value: String(n),
            label: t("daysAfter", { count: n }),
          }))}
        />
        <SelectField
          label={t("graceDays")}
          name="graceDays"
          defaultValue={String(settings.graceDays)}
          options={[0, 3, 7].map((n) => ({
            value: String(n),
            label: n ? t("days", { count: n }) : t("noGrace"),
          }))}
        />
        <SelectField
          label={t("roundTo")}
          name="roundTo"
          defaultValue={String(settings.roundTo)}
          options={[1000, 10000].map((n) => ({
            value: String(n),
            label: t(`round.${n}` as "round.1000"),
          }))}
        />
        <label className="flex items-start gap-3 font-bold text-ocean">
          <input
            type="checkbox"
            name="autoIssue"
            defaultChecked={settings.autoIssue}
            className="mt-1 size-5"
          />
          <span>
            {t("autoIssue")}
            <span className="block text-sm font-normal text-body">{t("autoIssueHint")}</span>
          </span>
        </label>
      </section>
      <section className="space-y-3 rounded-card border border-hairline bg-white p-6">
        <h2 className="font-sans text-lg font-extrabold normal-case tracking-normal">
          {t("smsTitle")}
        </h2>
        <p className="text-sm">{t("smsLead")}</p>
        {toggles.map((k) => (
          <label key={k} className="flex items-start gap-3 font-bold text-ocean">
            <input type="checkbox" name={k} defaultChecked={settings[k]} className="mt-1 size-5" />
            <span>
              {t(`sms.${k}`)}
              <span className="block text-sm font-normal text-body">{t(`smsWhen.${k}`)}</span>
            </span>
          </label>
        ))}
        <p className="text-sm">{t("smsAlways")}</p>
      </section>
      <SubmitButton pendingLabel={t("saving")} className="w-full sm:w-auto">
        {t("save")}
      </SubmitButton>
    </form>
  );
}

export function PriceForm({ classId, current }: { classId: string; current: string }) {
  const t = useTranslations("Admin.finance.price");
  const [date, setDate] = useState(tehranDateKey(new Date()));
  const [state, action] = useActionState(addPriceAction, initial);
  const err = useFieldError(state);
  return (
    <form action={action} className="space-y-3 rounded-2xl bg-surface p-4">
      <Errors state={state} />
      <input type="hidden" name="classId" value={classId} />
      <Field
        label={t("new")}
        name="price"
        inputMode="numeric"
        dir="ltr"
        hint={t("current", { price: current })}
        error={err("price")}
      />
      <DatePicker
        label={t("from")}
        name="effectiveFrom"
        value={date}
        onChange={setDate}
        allowed={() => true}
        placeholder={t("from")}
        error={err("effectiveFrom")}
      />
      <p className="text-sm">{t("hint")}</p>
      <SubmitButton pendingLabel={t("saving")} className="w-full sm:w-auto">
        {t("save")}
      </SubmitButton>
    </form>
  );
}
