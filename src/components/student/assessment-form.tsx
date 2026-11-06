"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { ErrorAlert } from "@/components/ui/alert";
import { inputClass } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { submitAssessmentAction, type AssessmentFormState } from "@/server/assessments/actions";

type Q = {
  id: string;
  kind: "mc" | "short" | "essay";
  prompt: string;
  options: string[] | null;
  points: number;
};
const initial: AssessmentFormState = { status: "idle" };

/** One page with every question; answers are sent together and saved only on hand-in. */
export function AssessmentForm({
  assessmentId,
  questions,
  given,
}: {
  assessmentId: string;
  questions: Q[];
  given: { questionId: string; choice: number | null; text: string | null }[];
}) {
  const t = useTranslations("Student.assessment");
  const [state, action] = useActionState(submitAssessmentAction, initial);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="assessmentId" value={assessmentId} />
      {state.status === "error" && (
        <ErrorAlert>{t(`errors.${state.error as "invalid"}`)}</ErrorAlert>
      )}
      {questions.map((q, i) => {
        const mine = given.find((g) => g.questionId === q.id);
        return (
          <fieldset
            key={q.id}
            className="space-y-3 rounded-card border border-hairline bg-white p-5"
          >
            <legend className="text-sm font-bold text-cinnamon-ink">
              {t("question", { n: i + 1, points: q.points })}
            </legend>
            <p dir="auto" className="font-semibold text-ocean">
              {q.prompt}
            </p>
            {q.kind === "mc" &&
              q.options?.map((o, j) => (
                <label
                  key={j}
                  className="flex min-h-12 items-center gap-3 rounded-lg border-[1.5px] border-line px-3 has-[:checked]:border-brand"
                >
                  <input
                    type="radio"
                    name={`c:${q.id}`}
                    value={j}
                    defaultChecked={mine?.choice === j}
                  />
                  <span dir="auto">{o}</span>
                </label>
              ))}
            {q.kind === "short" && (
              <input
                name={`t:${q.id}`}
                dir="auto"
                defaultValue={mine?.text ?? ""}
                placeholder={t("shortPlaceholder")}
                className={inputClass}
              />
            )}
            {q.kind === "essay" && (
              <textarea
                name={`t:${q.id}`}
                dir="auto"
                rows={6}
                defaultValue={mine?.text ?? ""}
                placeholder={t("essayPlaceholder")}
                className={`${inputClass} py-3`}
              />
            )}
          </fieldset>
        );
      })}
      <SubmitButton pendingLabel={t("submitting")}>{t("submit")}</SubmitButton>
    </form>
  );
}
