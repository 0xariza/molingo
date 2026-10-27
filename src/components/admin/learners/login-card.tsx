"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { ErrorAlert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  createLoginAction,
  newLoginLinkAction,
  type LoginFormState,
} from "@/server/students/actions";
import type { LoginState } from "@/server/students/login";
import { LinkPanel } from "./link-panel";

const initial: LoginFormState = { status: "idle" };

const stateTone: Record<LoginState, string> = {
  none: "bg-mist text-brand",
  pending: "bg-[#fcefd3] text-[#8a520e]",
  active: "bg-[#ddf5e8] text-[#14613a]",
  off: "bg-[#edf0f3] text-[#4a5866]",
};

/** The learner's login: create it, or issue a fresh activation / password-reset link. */
export function LoginCard({
  studentId,
  phone,
  login,
}: {
  studentId: string;
  phone: string;
  login: LoginState;
}) {
  const t = useTranslations("Admin.learners.login");
  const [created, create] = useActionState(createLoginAction, initial);
  const [renewed, renew] = useActionState(newLoginLinkAction, initial);
  // The newest result wins: after creating, a renewal replaces the first link.
  const result = renewed.status !== "idle" ? renewed : created;

  return (
    <section
      aria-labelledby="login-title"
      className="space-y-4 rounded-card border border-whale bg-white p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="login-title"
          className="font-sans text-lg font-extrabold normal-case tracking-normal"
        >
          {t("title")}
        </h2>
        <span className={`rounded-pill px-3 py-0.5 text-sm font-bold ${stateTone[login]}`}>
          {t(`state.${login}`)}
        </span>
      </div>
      <p>{t(`body.${login}`)}</p>
      {result.status === "error" && <ErrorAlert>{t(`errors.${result.error}`)}</ErrorAlert>}
      {result.status === "success" && <LinkPanel link={result.link} phone={phone} />}
      {login === "none" && (
        <form action={create}>
          <input type="hidden" name="id" value={studentId} />
          <SubmitButton pendingLabel={t("creating")} className="w-full sm:w-auto">
            {t("create")}
          </SubmitButton>
        </form>
      )}
      {(login === "pending" || login === "active") && (
        <form action={renew}>
          <input type="hidden" name="id" value={studentId} />
          <SubmitButton pendingLabel={t("making")} className="w-full sm:w-auto">
            {login === "pending" ? t("newLink") : t("resetLink")}
          </SubmitButton>
        </form>
      )}
    </section>
  );
}
