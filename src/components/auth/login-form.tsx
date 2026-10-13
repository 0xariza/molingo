"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";
import { ErrorAlert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { loginAction } from "@/server/auth/actions";

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const [state, action] = useActionState(loginAction, undefined);
  const formError = state?.error && !state.field ? t(`errors.${state.error}`) : undefined;
  const fieldError = (name: string) =>
    state?.field === name && state.error ? t(`errors.${state.error}`) : undefined;

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {next && <input type="hidden" name="next" value={next} />}
      {formError && <ErrorAlert>{formError}</ErrorAlert>}
      <Field
        label={t("phone")}
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="username"
        dir="ltr"
        required
        placeholder={t("phoneHint")}
        defaultValue={state?.phone}
        error={fieldError("phone")}
        // LTR digits, but aligned with the form's start edge in Persian too.
        className="rtl:text-end"
      />
      <PasswordField
        label={t("password")}
        name="password"
        autoComplete="current-password"
        required
        error={fieldError("password")}
      />
      <SubmitButton pendingLabel={t("submitting")}>{t("submitLogin")}</SubmitButton>
    </form>
  );
}
