"use client";

import { Trash } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { ErrorAlert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { deleteClassAction, type ClassFormState } from "@/server/classes/actions";

const initial: ClassFormState = { status: "idle" };

/** Deletes a class that has no history yet, after a confirm. */
export function DeleteClass({ id, name }: { id: string; name: string }) {
  const t = useTranslations("Admin.classes");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(deleteClassAction, initial);
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-red-200 bg-white p-6">
      <p className="text-sm">{t("deleteClass.hint")}</p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${buttonClass("ghost")} text-red-700`}
      >
        <Trash aria-hidden size={18} />
        {t("deleteClass.button")}
      </button>
      {open && (
        <Modal
          title={t("deleteClass.title", { name })}
          description={t("deleteClass.lead")}
          closeLabel={t("deleteClass.keep")}
          onClose={() => setOpen(false)}
        >
          <form action={action} className="space-y-4">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="locale" value={locale} />
            {state.error && (
              <ErrorAlert>
                {t(`deleteClass.errors.${state.error as "has_history" | "not_found"}`)}
              </ErrorAlert>
            )}
            <div className="flex flex-wrap justify-end gap-3 border-t border-mist pt-4">
              <button type="button" onClick={() => setOpen(false)} className={buttonClass("ghost")}>
                {t("deleteClass.keep")}
              </button>
              <SubmitButton
                pendingLabel={t("deleteClass.saving")}
                variant="danger"
                className="w-full sm:w-auto"
              >
                {t("deleteClass.confirm")}
              </SubmitButton>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
