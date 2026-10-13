"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";
import { ErrorAlert } from "@/components/ui/alert";
import { PasswordField } from "@/components/ui/password-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { setPasswordAction } from "@/server/auth/actions";

type Props = { token: string; kind: "activation" | "reset"; phone: string };

export function SetPasswordForm({ token, kind, phone }: Props) {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const [state, action] = useActionState(setPasswordAction, undefined);
  const error = state?.error ? t(`errors.${state.error}`) : undefined;

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="kind" value={kind} />
      {/* Lets password managers save the login under the right username. */}
      <input type="hidden" name="username" autoComplete="username" value={phone} />
      {error && !state?.field && <ErrorAlert>{error}</ErrorAlert>}
      <PasswordField
        label={t("newPassword")}
        name="password"
        autoComplete="new-password"
        required
        minLength={8}
        hint={t("passwordHint")}
        error={state?.field === "password" ? error : undefined}
      />
      <PasswordField
        label={t("confirmPassword")}
        name="confirm"
        autoComplete="new-password"
        required
        error={state?.field === "confirm" ? error : undefined}
      />
      <SubmitButton pendingLabel={t("submitting")}>
        {kind === "activation" ? t("submitActivate") : t("submitReset")}
      </SubmitButton>
    </form>
  );
}
