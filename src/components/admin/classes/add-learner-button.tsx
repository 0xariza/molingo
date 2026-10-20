"use client";

import { Plus } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { ErrorAlert } from "@/components/ui/alert";
import { Combobox, type ComboItem } from "@/components/ui/combobox";
import { Modal } from "@/components/ui/modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { enrollAction, type ClassFormState } from "@/server/classes/actions";
import { learnerItems, type Candidate } from "./learner-picker-items";

const initial: ClassFormState = { status: "idle" };

/** Search a learner and seat them in the class. Used on class cards and on the class page. */
export function AddLearnerPicker({
  classId,
  candidates,
  inClass,
  onDone,
  autoFocus,
}: {
  classId: string;
  candidates: Candidate[];
  inClass: string[];
  onDone?: () => void;
  autoFocus?: boolean;
}) {
  const t = useTranslations("Admin.classes");
  const ts = useTranslations("Admin.learners.status");
  const locale = useLocale() as Locale;
  const [picked, setPicked] = useState<ComboItem | null>(null);
  const [state, action] = useActionState(async (prev: ClassFormState, form: FormData) => {
    const next = await enrollAction(prev, form);
    if (next.status === "success") {
      setPicked(null);
      onDone?.();
    }
    return next;
  }, initial);
  const items = learnerItems(
    candidates,
    locale,
    (s) => ts(s),
    (id) => (inClass.includes(id) ? t("detail.inClass") : null),
  );

  return (
    <div className="space-y-3">
      {state.status === "error" && state.error && (
        <ErrorAlert>{t(`errors.${state.error as "full"}`)}</ErrorAlert>
      )}
      <Combobox
        label={t("detail.addLearner")}
        placeholder={t("form.learnersPlaceholder")}
        clearLabel={t("form.clear")}
        items={items}
        autoFocus={autoFocus}
        onPick={setPicked}
        empty={(query) => (
          <>
            {t("form.noMatch", { query })}{" "}
            <Link href="/admin/students/new" className="font-bold text-brand underline">
              {t("form.newLearner")}
            </Link>
          </>
        )}
      />
      {picked && (
        <form
          action={action}
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-whale bg-surface px-4 py-3"
        >
          <input type="hidden" name="classId" value={classId} />
          <input type="hidden" name="studentId" value={picked.id} />
          <span>
            <strong className="text-ocean">{picked.primary}</strong>{" "}
            <span className="text-sm">{picked.meta}</span>
          </span>
          <span className="flex gap-2">
            <button
              type="button"
              onClick={() => setPicked(null)}
              className="min-h-touch rounded-pill border border-line/50 px-4 font-bold"
            >
              {t("form.cancel")}
            </button>
            <SubmitButton pendingLabel={t("form.saving")} className="px-5">
              {t("detail.addButton")}
            </SubmitButton>
          </span>
        </form>
      )}
    </div>
  );
}

/** The quiet "+ Add learner" button on a class card; opens the picker in a dialog. */
export function AddLearnerButton({
  classId,
  className,
  candidates,
  inClass,
}: {
  classId: string;
  className: string;
  candidates: Candidate[];
  inClass: string[];
}) {
  const t = useTranslations("Admin.classes");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("card.addLabel", { name: className })}
        className="relative z-10 inline-flex min-h-10 items-center gap-1.5 rounded-pill border border-line/50 bg-white px-3.5 text-sm font-bold text-brand hover:border-brand hover:bg-surface"
      >
        <Plus aria-hidden size={16} weight="bold" />
        {t("card.addLearner")}
      </button>
      {open && (
        <Modal
          title={t("detail.addLearner")}
          description={className}
          closeLabel={t("close")}
          onClose={() => setOpen(false)}
        >
          <AddLearnerPicker
            classId={classId}
            candidates={candidates}
            inClass={inClass}
            autoFocus
            onDone={() => setOpen(false)}
          />
        </Modal>
      )}
    </>
  );
}
