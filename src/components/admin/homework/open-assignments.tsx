"use client";

import { Trash } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatNumber, formatTime } from "@/lib/format";
import { classTitle } from "@/lib/names";
import { deleteAssignmentAction } from "@/server/homework/actions";
import type { OpenAssignment } from "@/server/homework/assignments";

/** Assignments still open, with how many answers are in, and delete (with everything under it). */
export function OpenAssignments({ items }: { items: OpenAssignment[] }) {
  const t = useTranslations("Admin.homework.open");
  const locale = useLocale() as Locale;
  const n = (v: number) => formatNumber(v, locale);
  const [deleting, setDeleting] = useState<OpenAssignment | null>(null);

  return (
    <section aria-labelledby="open-hw" className="space-y-3">
      <h2 id="open-hw" className="font-sans text-xl font-extrabold normal-case tracking-normal">
        {t("title")}
      </h2>
      {items.length === 0 ? (
        <p>{t("empty")}</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {items.map((a) => (
            <li key={a.id} className="space-y-2.5 rounded-card border border-hairline bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <p className="font-bold text-ocean">{a.title}</p>
                <button
                  type="button"
                  aria-label={t("deleteLabel", { title: a.title })}
                  title={t("delete")}
                  onClick={() => setDeleting(a)}
                  className="-me-2 -mt-2 grid size-10 shrink-0 place-items-center rounded-full hover:bg-surface hover:text-red-700"
                >
                  <Trash aria-hidden size={18} />
                </button>
              </div>
              <p className="text-sm">
                {a.dueAt
                  ? t("due", {
                      date: `${formatDate(a.dueAt, locale, { year: false })} · ${formatTime(a.dueAt, locale)}`,
                    })
                  : t("noDue")}
              </p>
              <p className="text-sm">
                {t("source", {
                  class: classTitle({ nameFa: a.classNameFa, nameEn: a.classNameEn }, locale),
                  n: a.sessionNumber,
                })}
              </p>
              <div aria-hidden="true" className="h-2 overflow-hidden rounded-pill bg-mist">
                <div
                  className="h-2 bg-brand"
                  style={{ width: `${Math.round((a.handedIn / a.recipients) * 100)}%` }}
                />
              </div>
              <p className="text-sm">{t("progress", { in: n(a.handedIn), of: n(a.recipients) })}</p>
            </li>
          ))}
        </ul>
      )}
      {deleting && (
        <Modal
          title={t("deleteTitle")}
          description={t("deleteBody", { title: deleting.title })}
          closeLabel={t("cancel")}
          onClose={() => setDeleting(null)}
        >
          <form
            action={async (form) => {
              await deleteAssignmentAction(form);
              setDeleting(null);
            }}
            className="flex justify-end gap-3"
          >
            <input type="hidden" name="id" value={deleting.id} />
            <button
              type="button"
              onClick={() => setDeleting(null)}
              className={buttonClass("ghost")}
            >
              {t("cancel")}
            </button>
            <SubmitButton variant="danger" pendingLabel={t("deleteConfirm")} className="">
              {t("deleteConfirm")}
            </SubmitButton>
          </form>
        </Modal>
      )}
    </section>
  );
}
