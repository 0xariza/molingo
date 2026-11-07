"use client";

import { CheckCircle } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { sendAfterClassAction, type HomeworkFormState } from "@/server/homework/actions";

const initial: HomeworkFormState = { status: "idle" };

/** True while an element with this id is on the page (the open card's form comes and goes). */
function useOnPage(id: string | null) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!id) return;
    const check = () => setOn(Boolean(document.getElementById(id)));
    check();
    const watch = new MutationObserver(check);
    watch.observe(document.body, { childList: true, subtree: true });
    return () => watch.disconnect();
  }, [id]);
  return id ? on : false;
}

/**
 * The page's sticky bar: what is in it, what still blocks sending, "Save draft" (submits the form
 * of the open step through its id) and "Save and send", which publishes the drafts to learners.
 */
export function SendBar({
  sessionId,
  topics,
  homework,
  issues,
  sent,
  draftForm,
}: {
  sessionId: string;
  topics: number;
  homework: number;
  /** Already worded, e.g. "homework 1: No audio". */
  issues: string[];
  sent: boolean;
  /** Id of the form "Save draft" submits; null on steps that have no draft to save. */
  draftForm: string | null;
}) {
  const t = useTranslations("Admin.afterClass");
  const [state, action] = useActionState(sendAfterClassAction, initial);
  const canDraft = useOnPage(draftForm);
  const blocked = issues.length > 0;
  const done = sent && !blocked;
  return (
    <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-3 rounded-card border border-hairline bg-white p-3 ps-5 shadow-[0_8px_30px_rgba(7,30,54,.14)]">
      <div className="min-w-48 flex-1 leading-snug">
        <p className="font-bold text-ocean">{t("barCounts", { topics, homework })}</p>
        <p
          role={blocked ? "alert" : "status"}
          className={`text-sm ${blocked ? "font-bold text-cinnamon-ink" : ""}`}
        >
          {state.error
            ? t(`errors.${state.error as "issues"}`)
            : blocked
              ? t("complete", { list: issues.join(" · ") })
              : done
                ? t("sentState")
                : t("sendHint")}
        </p>
      </div>
      {draftForm && (
        <button
          type="submit"
          form={draftForm}
          disabled={!canDraft}
          className={buttonClass("ghost", "w-full sm:w-auto")}
        >
          {t("saveDraft")}
        </button>
      )}
      {done ? (
        <span className="inline-flex min-h-touch w-full items-center justify-center gap-2 rounded-[14px] bg-[#ddf5e8] px-6 font-bold text-[#14613a] sm:w-auto">
          <CheckCircle aria-hidden weight="fill" size={20} />
          {t("sentState")}
        </span>
      ) : (
        <form action={action} className="w-full sm:w-auto">
          <input type="hidden" name="sessionId" value={sessionId} />
          <SubmitButton pendingLabel={t("sending")} blocked={blocked} className="w-full sm:w-auto">
            {t("sendNow")}
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
