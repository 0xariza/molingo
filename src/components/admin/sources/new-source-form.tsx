"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { LevelPicker } from "@/components/admin/classes/level-picker";
import { Field } from "@/components/ui/field";
import { Stepper } from "@/components/ui/stepper";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Locale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";
import { createSourceAction, type SourceFormState } from "@/server/paths/actions";

const initial: SourceFormState = { status: "idle" };

/** Step 1 of a source map: its name, level and chapter count; each chapter becomes a station. */
export function NewSourceForm() {
  const t = useTranslations("Admin.sources");
  const locale = useLocale() as Locale;
  const [state, action] = useActionState(createSourceAction, initial);
  const [level, setLevel] = useState("A2");
  const [chapters, setChapters] = useState(8);
  const [sessions, setSessions] = useState(2);
  const n = (v: number) => formatNumber(v, locale);
  const err = (field: string) => {
    const key = state.fieldErrors?.[field];
    return key ? t(`errors.${key as "title"}`) : undefined;
  };
  return (
    <form
      action={action}
      noValidate
      className="space-y-5 rounded-card border border-hairline bg-white p-6 sm:p-7"
    >
      <input type="hidden" name="locale" value={locale} />
      <Field
        label={t("form.title")}
        name="title"
        autoComplete="off"
        placeholder={t("form.titlePlaceholder")}
        error={err("title")}
      />
      <LevelPicker value={level} onChange={setLevel} error={err("level")} />
      <div className="grid items-start gap-5 sm:grid-cols-2">
        <Stepper
          id="chapters"
          label={t("form.chapters")}
          name="chapters"
          value={chapters}
          min={1}
          max={30}
          display={n(chapters)}
          onChange={setChapters}
          lessLabel={t("form.less")}
          moreLabel={t("form.more")}
        />
        <Stepper
          id="planned"
          label={t("form.plannedSessions")}
          name="plannedSessions"
          value={sessions}
          min={1}
          max={4}
          display={n(sessions)}
          onChange={setSessions}
          lessLabel={t("form.less")}
          moreLabel={t("form.more")}
        />
      </div>
      <p className="rounded-2xl bg-mist px-4 py-3 text-sm text-ocean">
        {t("form.preview", { stations: n(chapters), sessions: n(chapters * sessions) })}
      </p>
      <SubmitButton pendingLabel={t("form.creating")} className="w-full sm:w-auto">
        {t("form.create")}
      </SubmitButton>
    </form>
  );
}
