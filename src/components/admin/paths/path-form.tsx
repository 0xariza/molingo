"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";
import { ErrorAlert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { savePathAction, type SourceFormState } from "@/server/paths/actions";
import { PathEditor, type PathSource, type PathStart } from "./path-editor";

const initial: SourceFormState = { status: "idle" };

/** Adds or edits the path of a class that already exists. */
export function PathForm({
  classId,
  level,
  sources,
  sessionCount,
  start,
}: {
  classId: string;
  level: string;
  sources: PathSource[];
  sessionCount: number;
  start: PathStart | null;
}) {
  const t = useTranslations("Admin.paths");
  const locale = useLocale() as Locale;
  const [state, action] = useActionState(savePathAction, initial);
  return (
    <form
      action={action}
      noValidate
      className="space-y-5 rounded-card border border-hairline bg-white p-6 sm:p-7"
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="classId" value={classId} />
      {state.error && <ErrorAlert>{t(`errors.${state.error as "locked"}`)}</ErrorAlert>}
      <PathEditor
        level={level}
        sources={sources}
        sessionCount={sessionCount}
        start={start}
        optional={false}
      />
      <div className="flex flex-wrap items-center justify-end gap-3">
        {state.status === "success" && (
          <p role="status" className="me-auto text-sm font-bold text-[#1f7a4d]">
            {t("page.saved")}
          </p>
        )}
        <Link href={`/admin/classes/${classId}`} className={buttonClass("ghost")}>
          {t("cancel")}
        </Link>
        <SubmitButton pendingLabel={t("page.saving")} className="w-full sm:w-auto">
          {start ? t("page.save") : t("page.create")}
        </SubmitButton>
      </div>
    </form>
  );
}
