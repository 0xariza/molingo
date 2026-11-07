"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { ErrorAlert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { saveStationCheckAction, type CheckFormState } from "@/server/paths/actions";
import type { getStationCheck } from "@/server/paths/station-check";

const initial: CheckFormState = { status: "idle" };

/** Part 3 of the after-class page, on a station's last session: ready / again per skill, then close or hold. */
export function StationCheck({
  sessionId,
  check,
}: {
  sessionId: string;
  check: NonNullable<Awaited<ReturnType<typeof getStationCheck>>>;
}) {
  const t = useTranslations("Admin.afterClass.check");
  const [state, action] = useActionState(saveStationCheckAction, initial);
  const mark = (studentId: string, skillId: string) =>
    check.results.find((r) => r.studentId === studentId && r.skillId === skillId)?.result;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="sessionId" value={sessionId} />
      {state.status === "error" && (
        <ErrorAlert>{t(`errors.${(state.error ?? "invalid") as "invalid"}`)}</ErrorAlert>
      )}
      {state.status === "success" && <p role="status">{t("saved")}</p>}
      {check.closed && <p className="font-bold text-ocean">{t("closed")}</p>}
      <div className="space-y-4">
        {check.learners.map((l) => (
          <fieldset key={l.id} className="space-y-2">
            <legend className="text-sm font-bold text-ocean" dir="auto">
              {l.fullNameFa}
            </legend>
            <ul className="space-y-2">
              {check.skills.map((k) => (
                <li key={k.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span dir="auto">{k.text}</span>
                  <span className="flex gap-2">
                    {(["ready", "again"] as const).map((r) => (
                      <label
                        key={r}
                        className="flex min-h-11 items-center gap-2 rounded-pill border-[1.5px] border-line px-4 text-sm font-bold has-[:checked]:border-brand has-[:checked]:bg-brand has-[:checked]:text-white"
                      >
                        <input
                          type="radio"
                          name={`r:${l.id}:${k.id}`}
                          value={r}
                          defaultChecked={mark(l.id, k.id) === r}
                          className="sr-only"
                        />
                        {t(r)}
                      </label>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </fieldset>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <SubmitButton name="action" value="close" pendingLabel={t("saving")} className="">
          {t("close")}
        </SubmitButton>
        <SubmitButton
          name="action"
          value="hold"
          pendingLabel={t("saving")}
          variant="ghost"
          className=""
        >
          {t("hold")}
        </SubmitButton>
      </div>
    </form>
  );
}
