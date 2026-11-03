"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";
import { ErrorAlert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { TextareaField } from "@/components/ui/field";
import { reviewAction, type HomeworkFormState } from "@/server/homework/actions";

const initial: HomeworkFormState = { status: "idle" };

/** Text feedback and the two outcomes: reviewed (then the next in the queue), or a revision. */
export function ReviewForm({
  id,
  name,
  feedback,
  hasNext,
}: {
  id: string;
  name: string;
  feedback: string | null;
  hasNext: boolean;
}) {
  const t = useTranslations("Admin.homework.review");
  const te = useTranslations("Admin.homework.errors");
  const locale = useLocale();
  const [state, action, pending] = useActionState(reviewAction, initial);
  return (
    <form action={action} className="space-y-4 rounded-card border border-hairline bg-white p-5">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="locale" value={locale} />
      <h2 className="font-sans text-lg font-extrabold normal-case tracking-normal">
        {t("feedback")}
      </h2>
      {state.status === "error" && state.error && (
        <ErrorAlert>{te(state.error as "not_found")}</ErrorAlert>
      )}
      <TextareaField
        label={t("feedbackFor", { name })}
        name="feedback"
        rows={7}
        defaultValue={feedback ?? ""}
        maxLength={2000}
        hint={t("help", { name })}
        error={state.fieldErrors?.feedback && te(state.fieldErrors.feedback as "feedback")}
      />
      <button
        type="submit"
        name="decision"
        value="reviewed"
        disabled={pending}
        className={buttonClass("primary", "w-full")}
      >
        {pending ? t("sending") : hasNext ? t("markNext") : t("mark")}
      </button>
      <button
        type="submit"
        name="decision"
        value="needs_revision"
        disabled={pending}
        className={buttonClass("ghost", "w-full")}
      >
        {t("revision_ask")}
      </button>
      <p className="text-center text-sm">{t("change")}</p>
    </form>
  );
}
