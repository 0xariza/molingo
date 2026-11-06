"use client";

import { Plus, Trash } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatTime } from "@/lib/format";
import { learnerNames } from "@/lib/names";
import { deleteAssignmentAction } from "@/server/homework/actions";
import type { AfterClass, SessionHomework } from "@/server/homework/after-class";
import { HomeworkEditor } from "./homework-editor";
import { TYPE_LOOK } from "@/components/homework/homework-types";

/** Part 2 of the after-class page: the session's homework items, one open for editing at a time. */
export function HomeworkList({ page }: { page: AfterClass }) {
  const t = useTranslations("Admin.afterClass");
  const ta = useTranslations("Admin.homework.assignDialog");
  const to = useTranslations("Admin.homework.open");
  const locale = useLocale() as Locale;
  // "new", an item id, or null.
  const [open, setOpen] = useState<string | null>(page.homework.length ? null : "new");
  const [deleting, setDeleting] = useState<SessionHomework | null>(null);

  const meta = (h: SessionHomework) =>
    t("meta", {
      type: ta(`types.${h.type}`),
      files: h.files.length,
      who: h.all
        ? t("forAll")
        : t("forSome", {
            names: page.learners
              .filter((l) => h.recipientIds.includes(l.id))
              .map((l) => learnerNames(l, locale).primary)
              .join(locale === "fa" ? "، " : ", "),
          }),
      due: h.dueAt
        ? t("due", {
            date: `${formatDate(h.dueAt, locale, { year: false })} ${formatTime(h.dueAt, locale)}`,
          })
        : t("noDue"),
    });

  return (
    <div className="space-y-3">
      {page.homework.length === 0 && open !== "new" && <p>{t("none")}</p>}
      <ol className="space-y-3">
        {page.homework.map((h) => {
          const look = TYPE_LOOK[h.type];
          const Icon = look.icon;
          const editing = open === h.id;
          return (
            <li
              key={h.id}
              className={`rounded-card border bg-white ${editing ? "border-brand" : "border-hairline"}`}
            >
              <div className="flex flex-wrap items-center gap-3 p-4">
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-xl ${look.tone}`}
                >
                  <Icon aria-hidden size={20} />
                </span>
                <div className="min-w-44 flex-1 leading-snug">
                  <p className="font-bold text-ocean">
                    <span dir="auto">{h.title}</span>
                  </p>
                  <p className="text-sm">{meta(h)}</p>
                  <p className="text-sm">
                    {t("handedIn", { in: h.handedIn, of: h.recipientIds.length })}
                  </p>
                </div>
                {!editing && (
                  <button
                    type="button"
                    aria-label={t("editLabel", { title: h.title })}
                    onClick={() => setOpen(h.id)}
                    className={buttonClass("ghost", "min-h-10 px-4 text-sm")}
                  >
                    {t("edit")}
                  </button>
                )}
                <button
                  type="button"
                  aria-label={to("deleteLabel", { title: h.title })}
                  title={to("delete")}
                  onClick={() => setDeleting(h)}
                  className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-surface hover:text-red-700"
                >
                  <Trash aria-hidden size={18} />
                </button>
              </div>
              {editing && (
                <div className="border-t border-mist p-4">
                  <HomeworkEditor page={page} item={h} onDone={() => setOpen(null)} />
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {open === "new" ? (
        <section
          aria-labelledby="hw-new"
          className="space-y-4 rounded-card border border-brand bg-white p-4"
        >
          <h3
            id="hw-new"
            className="font-sans text-base font-extrabold normal-case tracking-normal"
          >
            {ta("newTitle")}
          </h3>
          <HomeworkEditor key="new" page={page} item={null} onDone={() => setOpen(null)} />
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setOpen("new")}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-card border-[1.5px] border-dashed border-brand/50 font-bold text-brand hover:bg-surface"
        >
          <Plus aria-hidden size={18} weight="bold" />
          {t("add")}
        </button>
      )}

      {deleting && (
        <Modal
          title={to("deleteTitle")}
          description={to("deleteBody", { title: deleting.title })}
          closeLabel={to("cancel")}
          onClose={() => setDeleting(null)}
        >
          <form
            action={async (form) => {
              await deleteAssignmentAction(form);
              if (open === deleting.id) setOpen(null);
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
              {to("cancel")}
            </button>
            <SubmitButton variant="danger" pendingLabel={to("deleteConfirm")} className="">
              {to("deleteConfirm")}
            </SubmitButton>
          </form>
        </Modal>
      )}
    </div>
  );
}
