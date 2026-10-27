"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";
import { ErrorAlert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { FormSuccess } from "@/components/ui/form-success";
import { Honeypot } from "@/components/ui/honeypot";
import { SubmitButton } from "@/components/ui/submit-button";
import { requestAccessAction, type FormState } from "@/server/funnel/actions";

const initial: FormState = { status: "idle" };

/** "Request early access": a teacher lead for the owner (no self sign-up until Stage 3). */
export function RequestAccess() {
  const t = useTranslations("Home.start");
  const locale = useLocale();
  const [state, action] = useActionState(requestAccessAction, initial);

  if (state.status === "success") return <FormSuccess>{t("success")}</FormSuccess>;

  const v = state.values ?? {};
  const error = (field: "name" | "phone" | "learners") =>
    state.fieldErrors?.[field] ? t(`errors.${field}`) : undefined;
  return (
    <form action={action} noValidate className="relative grid gap-4 text-start sm:grid-cols-2">
      <input type="hidden" name="locale" value={locale} />
      <Honeypot />
      {state.error && (
        <div className="sm:col-span-2">
          <ErrorAlert>{t(`errors.${state.error as "rate_limited"}`)}</ErrorAlert>
        </div>
      )}
      <Field name="name" label={t("name")} defaultValue={v.name} error={error("name")} required />
      <Field
        name="phone"
        type="tel"
        inputMode="tel"
        dir="ltr"
        autoComplete="tel"
        label={t("phone")}
        defaultValue={v.phone}
        error={error("phone")}
        className="rtl:text-end"
        required
      />
      <Field
        name="learners"
        inputMode="numeric"
        label={t("learners")}
        defaultValue={v.learners}
        error={error("learners")}
        required
      />
      <SubmitButton pendingLabel={t("sending")} className="self-end">
        {t("submit")}
      </SubmitButton>
    </form>
  );
}
