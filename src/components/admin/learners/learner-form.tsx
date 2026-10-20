"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";
import { ErrorAlert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { Field, TextareaField } from "@/components/ui/field";
import { FormSuccess } from "@/components/ui/form-success";
import { SubmitButton } from "@/components/ui/submit-button";
import { Link } from "@/i18n/navigation";
import {
  createLearnerAction,
  updateLearnerAction,
  type LearnerFormState,
} from "@/server/students/actions";
import { LinkPanel } from "./link-panel";

export type LearnerFormValues = {
  fullNameFa: string;
  fullNameEn: string;
  phone: string;
  email: string;
  messengerHandle: string;
  notes: string;
};

const initial: LearnerFormState = { status: "idle" };

type Props =
  | { mode: "create"; defaults: LearnerFormValues; leadId?: string }
  | { mode: "edit"; defaults: LearnerFormValues; id: string };

/** Add a learner (optionally from a booking, optionally creating their login), or edit details. */
export function LearnerForm(props: Props) {
  const t = useTranslations("Admin.learners");
  const locale = useLocale();
  const [state, action] = useActionState(
    props.mode === "create" ? createLearnerAction : updateLearnerAction,
    initial,
  );
  const v: Record<string, string> = state.values ?? { ...props.defaults, createLogin: "on" };
  const err = (field: string) => {
    const key = state.fieldErrors?.[field];
    return key ? t(`errors.${key as "phone"}`) : undefined;
  };

  if (state.saved) {
    return (
      <div className="space-y-5 rounded-[1.75rem] border border-line/40 bg-white p-6 sm:p-8">
        <FormSuccess>{t("form.saved", { name: state.saved.name })}</FormSuccess>
        <LinkPanel link={state.saved.link} phone={state.saved.phone} />
        <Link href={`/admin/students/${state.saved.id}`} className={buttonClass("primary")}>
          {t("form.openProfile")}
        </Link>
      </div>
    );
  }

  return (
    <form
      action={action}
      noValidate
      className="space-y-6 rounded-[1.75rem] border border-line/40 bg-white p-6 sm:p-8"
    >
      <input type="hidden" name="locale" value={locale} />
      {props.mode === "edit" && <input type="hidden" name="id" value={props.id} />}
      {props.mode === "create" && props.leadId && (
        <input type="hidden" name="leadId" value={props.leadId} />
      )}

      {state.error && (
        <ErrorAlert>
          {t(`errors.${state.error}`)}{" "}
          {state.existingId && (
            <Link href={`/admin/students/${state.existingId}`} className="font-bold underline">
              {t("form.openExisting")}
            </Link>
          )}
        </ErrorAlert>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label={t("form.fullNameFa")}
          name="fullNameFa"
          lang="fa"
          dir="rtl"
          required
          autoComplete="off"
          defaultValue={v.fullNameFa}
          error={err("fullNameFa")}
        />
        <Field
          label={t("form.fullNameEn")}
          name="fullNameEn"
          lang="en"
          dir="ltr"
          autoComplete="off"
          defaultValue={v.fullNameEn}
          hint={t("form.fullNameEnHint")}
          error={err("fullNameEn")}
        />
        <Field
          label={t("form.phone")}
          name="phone"
          type="tel"
          inputMode="tel"
          dir="ltr"
          required
          autoComplete="off"
          defaultValue={v.phone}
          hint={t("form.phoneHint")}
          error={err("phone")}
        />
        <Field
          label={t("form.email")}
          name="email"
          type="email"
          dir="ltr"
          autoComplete="off"
          defaultValue={v.email}
          error={err("email")}
        />
        <Field
          label={t("form.messengerHandle")}
          name="messengerHandle"
          dir="ltr"
          autoComplete="off"
          defaultValue={v.messengerHandle}
          error={err("messengerHandle")}
        />
      </div>

      {props.mode === "create" && (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-bold text-ocean">{t("form.status")}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["lead", "active"] as const).map((status) => (
              <label
                key={status}
                className="flex min-h-touch cursor-pointer items-center gap-3 rounded-2xl border border-line/50 px-4 py-3 has-checked:border-brand has-checked:bg-mist"
              >
                <input
                  type="radio"
                  name="status"
                  value={status}
                  defaultChecked={(v.status || "active") === status}
                  className="size-4.5 accent-brand"
                />
                <span className="leading-snug">
                  <span className="block font-bold text-ocean">{t(`status.${status}`)}</span>
                  <span className="text-sm">{t(`statusHint.${status}`)}</span>
                </span>
              </label>
            ))}
          </div>
          {err("status") && <p className="text-sm font-medium text-red-700">{err("status")}</p>}
        </fieldset>
      )}

      <TextareaField
        label={t("form.notes")}
        name="notes"
        defaultValue={v.notes}
        hint={t("form.notesHint")}
        error={err("notes")}
      />

      {props.mode === "create" && (
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line/50 px-4 py-3 has-checked:border-brand has-checked:bg-mist">
          <input
            type="checkbox"
            name="createLogin"
            defaultChecked={v.createLogin === "on"}
            className="mt-1 size-4.5 accent-brand"
          />
          <span className="leading-snug">
            <span className="block font-bold text-ocean">{t("form.createLogin")}</span>
            <span className="text-sm">{t("form.createLoginHint")}</span>
          </span>
        </label>
      )}

      <div className="flex flex-wrap justify-end gap-3 border-t border-mist pt-5">
        <Link
          href={props.mode === "edit" ? `/admin/students/${props.id}` : "/admin/students"}
          className={buttonClass("ghost")}
        >
          {t("form.cancel")}
        </Link>
        <SubmitButton pendingLabel={t("form.saving")} className="w-full sm:w-auto">
          {props.mode === "create" ? t("form.save") : t("form.saveChanges")}
        </SubmitButton>
      </div>
    </form>
  );
}
