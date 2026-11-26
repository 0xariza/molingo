"use client";

import { Trash } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { ErrorAlert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { removeLearnerAction, type RemoveLearnerState } from "@/server/students/actions";

/** Takes the learner off the teacher's list, after a confirm. */
export function RemoveLearner({ id, name }: { id: string; name: string }) {
  const t = useTranslations("Admin.learners.remove");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(removeLearnerAction, {} as RemoveLearnerState);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${buttonClass("ghost")} text-red-700`}
      >
        <Trash aria-hidden size={18} />
        {t("button")}
      </button>
      {open && (
        <Modal
          title={t("title", { name })}
          description={t("lead")}
          closeLabel={t("keep")}
          onClose={() => setOpen(false)}
        >
          <form action={action} className="space-y-4">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="locale" value={locale} />
            {state.error && <ErrorAlert>{t(`errors.${state.error}`)}</ErrorAlert>}
            <div className="flex flex-wrap justify-end gap-3 border-t border-mist pt-4">
              <button type="button" onClick={() => setOpen(false)} className={buttonClass("ghost")}>
                {t("keep")}
              </button>
              <SubmitButton
                pendingLabel={t("saving")}
                variant="danger"
                className="w-full sm:w-auto"
              >
                {t("confirm")}
              </SubmitButton>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
