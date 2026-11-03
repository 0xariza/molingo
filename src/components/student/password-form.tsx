"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { ErrorAlert } from "@/components/ui/alert";
import { PasswordField } from "@/components/ui/password-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { changePasswordAction, type PasswordFormState } from "@/server/auth/actions";

const initial: PasswordFormState = { status: "idle" };

/** The learner changes their password: current, new and repeat. */
export function PasswordForm() {
  const t = useTranslations("Student.settings");
  const [state, action] = useActionState(changePasswordAction, initial);
  const error = state.status === "error" ? state.error : undefined;
  const at = (...keys: (typeof error)[]) =>
    keys.includes(error) && error ? t(`errors.${error}`) : undefined;
  return (
    <form
      // Remounts after a change, which also clears the three fields.
      key={state.status === "success" ? "done" : "form"}
      action={action}
      className="space-y-4 rounded-card border border-hairline bg-white p-5"
    >
      <h2 className="font-sans text-lg font-extrabold normal-case tracking-normal">
        {t("passwordTitle")}
      </h2>
      {state.status === "success" && (
        <p role="status" className="font-bold text-[#14613a]">
          {t("saved")}
        </p>
      )}
      {error === "rate_limited" && <ErrorAlert>{t("errors.rate_limited")}</ErrorAlert>}
      <PasswordField
        label={t("current")}
        name="current"
        autoComplete="current-password"
        error={at("wrong", "required")}
      />
      <PasswordField
        label={t("new")}
        name="next"
        autoComplete="new-password"
        hint={t("newHint")}
        error={at("too_short", "too_common")}
      />
      <PasswordField
        label={t("repeat")}
        name="confirm"
        autoComplete="new-password"
        error={at("mismatch")}
      />
      <SubmitButton pendingLabel={t("saving")}>{t("save")}</SubmitButton>
      <p className="text-center text-sm">{t("note")}</p>
    </form>
  );
}
