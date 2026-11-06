"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { ErrorAlert } from "@/components/ui/alert";
import { inputClass } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { saveAssessmentAction, type AssessmentFormState } from "@/server/assessments/actions";

type Q = {
  section: "reading" | "grammar" | "writing";
  kind: "mc" | "short" | "essay";
  prompt: string;
  points: number;
  options: string;
  correctIndex: number;
  accepted: string;
};
export type BuilderQuestion = Omit<Q, "options" | "accepted" | "correctIndex"> & {
  options: string[] | null;
  correctIndex: number | null;
  acceptedAnswers: string[] | null;
};

const empty: Q = {
  section: "grammar",
  kind: "mc",
  prompt: "",
  points: 1,
  options: "",
  correctIndex: 1,
  accepted: "",
};
const lines = (v: string) =>
  v
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
const initial: AssessmentFormState = { status: "idle" };

/** Part 1 of the assessment page: the exam's questions, sent as one JSON field. */
export function AssessmentBuilder({
  sessionId,
  minutes: startMinutes,
  questions,
  locked,
}: {
  sessionId: string;
  minutes: number;
  questions: BuilderQuestion[];
  locked: boolean;
}) {
  const t = useTranslations("Admin.assessment");
  const [state, action] = useActionState(saveAssessmentAction, initial);
  const [minutes, setMinutes] = useState(startMinutes);
  const [list, setList] = useState<Q[]>(
    questions.map((q) => ({
      ...q,
      options: q.options?.join("\n") ?? "",
      correctIndex: (q.correctIndex ?? 0) + 1,
      accepted: q.acceptedAnswers?.join("\n") ?? "",
    })),
  );
  const set = (i: number, patch: Partial<Q>) =>
    setList(list.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const data = JSON.stringify({
    sessionId,
    minutes,
    questions: list.map((q) =>
      q.kind === "mc"
        ? { ...q, options: lines(q.options), correctIndex: q.correctIndex - 1 }
        : q.kind === "short"
          ? { ...q, accepted: lines(q.accepted) }
          : q,
    ),
  });

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="data" value={data} />
      {state.status === "error" && (
        <ErrorAlert>{t(`errors.${state.error as "invalid"}`)}</ErrorAlert>
      )}
      {state.status === "success" && <p role="status">{t("saved")}</p>}
      <fieldset disabled={locked} className="space-y-4">
        <label className="block space-y-1.5 text-sm font-bold text-ocean">
          {t("minutes")}
          <input
            type="number"
            min={5}
            max={180}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className={`${inputClass} max-w-40`}
          />
        </label>
        {list.map((q, i) => (
          <div key={i} className="space-y-3 rounded-card border border-hairline p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1.5 text-sm font-bold text-ocean">
                {t("section")}
                <select
                  value={q.section}
                  onChange={(e) => set(i, { section: e.target.value as Q["section"] })}
                  className={inputClass}
                >
                  {(["reading", "grammar", "writing"] as const).map((s) => (
                    <option key={s} value={s}>
                      {t(`sections.${s}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5 text-sm font-bold text-ocean">
                {t("kind")}
                <select
                  value={q.kind}
                  onChange={(e) => set(i, { kind: e.target.value as Q["kind"] })}
                  className={inputClass}
                >
                  {(["mc", "short", "essay"] as const).map((k) => (
                    <option key={k} value={k}>
                      {t(`kinds.${k}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5 text-sm font-bold text-ocean">
                {t("points")}
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={q.points}
                  onChange={(e) => set(i, { points: Number(e.target.value) })}
                  className={inputClass}
                />
              </label>
            </div>
            <label className="block space-y-1.5 text-sm font-bold text-ocean">
              {t("prompt")}
              <textarea
                dir="auto"
                rows={2}
                value={q.prompt}
                onChange={(e) => set(i, { prompt: e.target.value })}
                className={`${inputClass} py-3`}
              />
            </label>
            {q.kind === "mc" && (
              <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
                <label className="block space-y-1.5 text-sm font-bold text-ocean">
                  {t("options")}
                  <textarea
                    dir="auto"
                    rows={4}
                    value={q.options}
                    onChange={(e) => set(i, { options: e.target.value })}
                    className={`${inputClass} py-3`}
                  />
                </label>
                <label className="block space-y-1.5 text-sm font-bold text-ocean">
                  {t("correct")}
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={q.correctIndex}
                    onChange={(e) => set(i, { correctIndex: Number(e.target.value) })}
                    className={inputClass}
                  />
                </label>
              </div>
            )}
            {q.kind === "short" && (
              <label className="block space-y-1.5 text-sm font-bold text-ocean">
                {t("accepted")}
                <textarea
                  dir="auto"
                  rows={3}
                  value={q.accepted}
                  onChange={(e) => set(i, { accepted: e.target.value })}
                  className={`${inputClass} py-3`}
                />
              </label>
            )}
            <button
              type="button"
              onClick={() => setList(list.filter((_, j) => j !== i))}
              className="min-h-11 text-sm font-bold text-red-700"
            >
              {t("remove")}
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setList([...list, empty])}
          className="min-h-12 w-full rounded-card border-[1.5px] border-dashed border-teal font-bold text-teal"
        >
          {t("addQuestion")}
        </button>
        {!locked && (
          <SubmitButton pendingLabel={t("saving")} blocked={list.length === 0} className="">
            {t("save")}
          </SubmitButton>
        )}
      </fieldset>
    </form>
  );
}
