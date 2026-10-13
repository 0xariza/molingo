"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";
import { ErrorAlert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { FormSuccess } from "@/components/ui/form-success";
import { Honeypot } from "@/components/ui/honeypot";
import { SubmitButton } from "@/components/ui/submit-button";
import { joinWaitlistAction, type FormState } from "@/server/funnel/actions";

const initial: FormState = { status: "idle" };

export function WaitlistForm() {
  const t = useTranslations("Landing.waitlist");
  const locale = useLocale();
  const [state, action] = useActionState(joinWaitlistAction, initial);

  if (state.status === "success") return <FormSuccess>{t("success")}</FormSuccess>;

  const fieldError = state.fieldErrors?.email;
  return (
    <form action={action} className="relative space-y-3" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <Honeypot />
      {state.error && <ErrorAlert>{t(`errors.${state.error as "rate_limited"}`)}</ErrorAlert>}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
        <Field
          label={t("email")}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          dir="ltr"
          required
          defaultValue={state.values?.email}
          error={fieldError ? t("errors.email") : undefined}
          className="rtl:text-end"
        />
        <SubmitButton pendingLabel={t("sending")} className="sm:mt-7">
          {t("submit")}
        </SubmitButton>
      </div>
    </form>
  );
}
