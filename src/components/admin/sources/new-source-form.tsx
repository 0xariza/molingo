"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { LevelPicker } from "@/components/admin/classes/level-picker";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Locale } from "@/i18n/routing";
import { createSourceAction, type SourceFormState } from "@/server/paths/actions";

const initial: SourceFormState = { status: "idle" };

/** A new source starts with its name and level plus one empty station; the teacher adds the rest on its map. */
export function NewSourceForm({ initialLevel }: { initialLevel: string }) {
  const t = useTranslations("Admin.sources");
  const locale = useLocale() as Locale;
  const [state, action] = useActionState(createSourceAction, initial);
  const [level, setLevel] = useState(initialLevel);
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
      <input type="hidden" name="chapters" value="1" />
      <input type="hidden" name="plannedSessions" value="2" />
      <SubmitButton pendingLabel={t("form.creating")} className="w-full sm:w-auto">
        {t("form.create")}
      </SubmitButton>
    </form>
  );
}
