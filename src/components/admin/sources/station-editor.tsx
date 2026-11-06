"use client";

import { Trash } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { ErrorAlert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Stepper } from "@/components/ui/stepper";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Locale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";
import { saveStationAction, type SourceFormState } from "@/server/paths/actions";

const initial: SourceFormState = { status: "idle" };
const MIN_SKILLS = 3;
const MAX_SKILLS = 4;

/** One station of a source map: its name, place in the book, suggested sessions and 3–4 skills. */
export function StationEditor({
  station,
  number,
}: {
  station: {
    id: string;
    title: string;
    sourceUnit: string;
    plannedSessions: number;
    skills: string[];
  };
  number: number;
}) {
  const t = useTranslations("Admin.sources");
  const locale = useLocale() as Locale;
  const [state, action] = useActionState(saveStationAction, initial);
  const [sessions, setSessions] = useState(station.plannedSessions);
  const [skills, setSkills] = useState(() => {
    const list = [...station.skills];
    while (list.length < MIN_SKILLS) list.push("");
    return list;
  });
  const n = (v: number) => formatNumber(v, locale);
  const filled = skills.filter((s) => s.trim()).length;
  const err = (field: string) => {
    const key = state.fieldErrors?.[field];
    return key ? t(`errors.${key as "title"}`) : undefined;
  };

  return (
    <form action={action} noValidate className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="stationId" value={station.id} />
      <h2 className="font-sans text-lg font-extrabold normal-case tracking-normal">
        {t("station.heading", { n: n(number) })}
      </h2>
      {state.error && <ErrorAlert>{t(`errors.${state.error as "notFound"}`)}</ErrorAlert>}
      <Field
        label={t("station.title")}
        name="title"
        defaultValue={station.title}
        autoComplete="off"
        placeholder={t("station.titlePlaceholder")}
        hint={t("station.titleHint")}
        error={err("title")}
      />
      <div className="grid items-start gap-5 sm:grid-cols-2">
        <Field
          label={t("station.sourceUnit")}
          name="sourceUnit"
          defaultValue={station.sourceUnit}
          autoComplete="off"
          placeholder={t("station.sourceUnitPlaceholder")}
          error={err("sourceUnit")}
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
      <fieldset className="space-y-2">
        <legend className="mb-1.5 flex w-full items-baseline justify-between gap-2 text-sm font-bold text-ocean">
          {t("station.skills")}
          <span className={filled >= MIN_SKILLS ? "text-[#14613a]" : "text-cinnamon-ink"}>
            {filled >= MIN_SKILLS
              ? t("station.skillsDone", { count: n(filled) })
              : t("station.skillsNeed", { count: n(MIN_SKILLS - filled) })}
          </span>
        </legend>
        {skills.map((value, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-6 shrink-0 text-center font-extrabold text-brand">{n(i + 1)}</span>
            <input
              name="skill"
              value={value}
              onChange={(e) => setSkills(skills.map((s, j) => (j === i ? e.target.value : s)))}
              aria-label={t("station.skillLabel", { n: n(i + 1) })}
              placeholder={i === 0 ? t("station.skillPlaceholder") : undefined}
              autoComplete="off"
              className="min-h-12 w-full rounded-lg border border-line bg-white px-3.5 text-base text-ocean outline-none placeholder:text-body/60 focus:border-teal focus:ring-4 focus:ring-teal/15"
            />
            <button
              type="button"
              aria-label={t("station.removeSkill", { n: n(i + 1) })}
              disabled={skills.length <= MIN_SKILLS}
              onClick={() => setSkills(skills.filter((_, j) => j !== i))}
              className="grid size-11 shrink-0 place-items-center rounded-xl text-body hover:bg-surface disabled:text-line/40"
            >
              <Trash aria-hidden size={18} />
            </button>
          </div>
        ))}
        {err("skills") && <p className="text-sm font-medium text-red-700">{err("skills")}</p>}
        {skills.length < MAX_SKILLS && (
          <button
            type="button"
            onClick={() => setSkills([...skills, ""])}
            className="min-h-touch text-sm font-bold text-brand"
          >
            {t("station.addSkill")}
          </button>
        )}
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <p className="rounded-xl bg-[#ddf5e8] px-3 py-2 text-[#14613a]">{t("station.good")}</p>
          <p className="rounded-xl bg-cinnamon-soft px-3 py-2 text-cinnamon-ink">
            {t("station.bad")}
          </p>
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {state.status === "success" && (
          <p role="status" className="text-sm font-bold text-[#1f7a4d]">
            {t("station.saved")}
          </p>
        )}
        <SubmitButton pendingLabel={t("station.saving")} className="w-full sm:w-auto">
          {t("station.save")}
        </SubmitButton>
      </div>
    </form>
  );
}
