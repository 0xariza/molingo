"use client";

import { X } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { ErrorAlert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Field, TextareaField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import {
  formatDate,
  formatNumber,
  formatTime,
  formatToman,
  localDigits,
  toLatinDigits,
} from "@/lib/format";
import { busyTitle, learnerNames } from "@/lib/names";
import { formatClock, parseClock, sessionTimes, weekdayOf, type Weekday } from "@/lib/schedule";
import { createClassAction, type ClassFormState } from "@/server/classes/actions";
import type { CefrLevel } from "@/server/classes/classes";
import { PathEditor, type PathSource } from "../paths/path-editor";
import { learnerItems, type Candidate } from "./learner-picker-items";
import { LevelPicker } from "./level-picker";
import { ScheduleFields } from "./schedule-fields";

const STEPS = ["class", "path", "schedule", "learners"] as const;
/** Which step shows each field, so a server error opens the right one. */
const FIELD_STEP: Record<string, number> = {
  nameFa: 1,
  nameEn: 1,
  level: 1,
  type: 1,
  capacity: 1,
  price: 1,
  description: 1,
  path: 2,
  sessionCount: 3,
  sessionMinutes: 3,
  slots: 3,
  startsOn: 3,
  studentIds: 4,
};

export type ClassFormDefaults = {
  nameFa: string;
  nameEn: string | null;
  level: CefrLevel;
  type: "private" | "group";
  capacity: number;
  sessionCount: number;
  sessionMinutes: number;
  slots: { weekday: Weekday; minutes: number }[];
  startsOn: string;
  price: number | null;
  description: string | null;
  isPublic: boolean;
  studentIds: string[];
};

const initial: ClassFormState = { status: "idle" };

const section = "space-y-5 rounded-card border border-hairline bg-white p-6 sm:p-7";
const heading = "font-sans text-lg font-extrabold normal-case tracking-normal";
const segment =
  "min-h-13 rounded-xl px-3 font-bold leading-tight text-body transition aria-pressed:bg-white aria-pressed:text-ocean aria-pressed:shadow-[0_1px_3px_rgba(7,30,54,.12)]";

/**
 * New class (or the next course of a finished one) in four steps: the class and its tuition, its
 * path (optional), its schedule, and its learners (at least one for a new class).
 */
export function ClassForm({
  defaults,
  candidates,
  sources,
  today,
  fromClassId,
}: {
  defaults: ClassFormDefaults;
  candidates: Candidate[];
  sources: PathSource[];
  /** Tehran date "YYYY-MM-DD"; earlier days can't start a class. */
  today: string;
  fromClassId?: string;
}) {
  const t = useTranslations("Admin.classes");
  const ts = useTranslations("Admin.learners.status");
  const locale = useLocale() as Locale;
  const tp = useTranslations("Admin.paths");
  const [state, action] = useActionState(createClassAction, initial);
  const [step, setStep] = useState(1);
  const [maxStep, setMaxStep] = useState(1);
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    // A refused submit opens the first step with an error.
    setSeen(state);
    const fields = Object.keys(state.fieldErrors ?? {});
    const errorStep = Math.min(
      ...fields.map((f) => FIELD_STEP[f] ?? 4),
      state.error?.startsWith("path")
        ? 2
        : state.error === "learner_unavailable"
          ? 4
          : state.error
            ? 3
            : 4,
    );
    if (state.status === "error") setStep(errorStep);
  }
  const n = (v: number) => formatNumber(v, locale);

  const [nameFa, setNameFa] = useState(defaults.nameFa);
  const [nameEn, setNameEn] = useState(defaults.nameEn ?? "");
  const [level, setLevel] = useState<string>(defaults.level);
  const [type, setType] = useState(defaults.type);
  const [capacity, setCapacity] = useState(Math.max(2, defaults.capacity));
  const [count, setCount] = useState(String(defaults.sessionCount));
  const [minutes, setMinutes] = useState(String(defaults.sessionMinutes));
  const [slots, setSlots] = useState(
    defaults.slots.map((s) => ({
      weekday: s.weekday,
      time: localDigits(formatClock(s.minutes), locale),
    })),
  );
  const [startsOn, setStartsOn] = useState(defaults.startsOn);
  const [price, setPrice] = useState(defaults.price ? String(defaults.price) : "");
  const [isPublic, setIsPublic] = useState(defaults.isPublic);
  const [picks, setPicks] = useState(defaults.studentIds);

  const seats = type === "private" ? 1 : capacity;
  const sessionCount = Number(toLatinDigits(count)) || 0;
  const validSlots = slots.flatMap((s) => {
    const m = parseClock(s.time);
    return m === null ? [] : [{ weekday: s.weekday, minutes: m }];
  });
  const startOk = validSlots.some((s) => s.weekday === weekdayOf(startsOn || "2000-01-01"));
  const times =
    startsOn && startOk && sessionCount > 0
      ? sessionTimes({
          startsOn,
          slots: validSlots,
          count: sessionCount,
          sessionMinutes: Number(minutes),
        })
      : [];
  const last = times.at(-1);
  const priceValue = Number(price) || 0;
  const shownPicks = picks.slice(0, seats);
  const stepBlocked =
    (step === 1 && (nameFa.trim().length < 2 || !(Number(price) > 0))) ||
    (step === 3 && (validSlots.length === 0 || !startOk || sessionCount < 1)) ||
    (step === 4 && !fromClassId && shownPicks.length === 0);

  const err = (field: string) => {
    const key = state.fieldErrors?.[field];
    return key ? t(`errors.${key as "nameFa"}`) : undefined;
  };
  const formError =
    state.error === "clash"
      ? state.clash
        ? t("errors.clash", {
            name: busyTitle(state.clash, locale, t("levelCheck")),
            when: `${formatDate(new Date(state.clash.startsAt), locale, { year: false })} ${formatTime(new Date(state.clash.startsAt), locale)}`,
          })
        : t("errors.clashGeneric")
      : state.error?.startsWith("path_")
        ? tp(`errors.${state.error.slice(5) as "locked"}`)
        : state.error
          ? t(`errors.${state.error as "past"}`)
          : null;

  return (
    <form action={action} noValidate className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="capacity" value={seats} />
      <input type="hidden" name="sessionCount" value={sessionCount || ""} />
      <input type="hidden" name="slots" value={JSON.stringify(slots)} />
      <input type="hidden" name="price" value={price} />
      <input type="hidden" name="studentIds" value={JSON.stringify(shownPicks)} />
      {fromClassId && <input type="hidden" name="fromClassId" value={fromClassId} />}
      {formError && <ErrorAlert>{formError}</ErrorAlert>}

      <ol aria-label={t("form.steps")} className="grid grid-cols-4 gap-2">
        {STEPS.map((key, i) => {
          const k = i + 1;
          const reached = k <= maxStep;
          return (
            <li key={key}>
              <button
                type="button"
                disabled={!reached}
                aria-current={step === k ? "step" : undefined}
                onClick={() => setStep(k)}
                className="flex w-full items-center gap-2 text-start disabled:opacity-60"
              >
                <span
                  className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-extrabold ${step === k ? "bg-ocean text-white" : k < maxStep || (reached && step > k) ? "bg-brand text-white" : "bg-mist text-brand"}`}
                >
                  {n(k)}
                </span>
                <span className="min-w-0 leading-tight">
                  <b className="block truncate text-sm text-ocean">{t(`form.step.${key}`)}</b>
                  <span className="text-xs">
                    {key === "path" ? t("form.optional") : t("form.required")}
                  </span>
                </span>
              </button>
              <span
                aria-hidden="true"
                className={`mt-1.5 block h-1 rounded-pill ${step === k ? "bg-ocean" : k < step ? "bg-brand" : "bg-mist"}`}
              />
            </li>
          );
        })}
      </ol>
      <div hidden={step !== 1} className="space-y-5">
        <section aria-labelledby="sec-class" className={section}>
          <h2 id="sec-class" className={heading}>
            {t("form.sectionClass")}
          </h2>
          <div className="grid items-start gap-5 sm:grid-cols-2">
            <Field
              label={t("form.nameFa")}
              name="nameFa"
              lang="fa"
              dir="rtl"
              value={nameFa}
              onChange={(e) => setNameFa(e.target.value)}
              autoComplete="off"
              error={err("nameFa")}
            />
            <Field
              label={t("form.nameEn")}
              name="nameEn"
              lang="en"
              dir="ltr"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              autoComplete="off"
              hint={t("form.nameEnHint")}
              error={err("nameEn")}
            />
          </div>
          <LevelPicker value={level} onChange={setLevel} error={err("level")} />
          <fieldset>
            <legend className="mb-1.5 text-sm font-bold text-ocean">{t("form.type")}</legend>
            <div className="grid grid-cols-2 gap-1 rounded-2xl bg-mist p-1">
              {(["private", "group"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={type === v}
                  onClick={() => setType(v)}
                  className={segment}
                >
                  {t(`type.${v}`)}
                  <span className="block text-xs font-medium">{t(`type.${v}Hint`)}</span>
                </button>
              ))}
            </div>
          </fieldset>
          {type === "group" && (
            <fieldset>
              <legend className="mb-1.5 text-sm font-bold text-ocean">{t("form.capacity")}</legend>
              <div className="grid grid-cols-3 gap-1 rounded-2xl bg-mist p-1">
                {[2, 3, 4].map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={capacity === c}
                    onClick={() => setCapacity(c)}
                    className={segment}
                  >
                    {t("form.capacityOption", { count: n(c) })}
                  </button>
                ))}
              </div>
              {err("capacity") && (
                <p className="mt-1.5 text-sm font-medium text-red-700">{err("capacity")}</p>
              )}
            </fieldset>
          )}
        </section>

        <section aria-labelledby="sec-price" className={section}>
          <h2 id="sec-price" className={heading}>
            {t("form.sectionPrice")}
          </h2>
          <div className="space-y-1.5">
            <label htmlFor="price" className="block text-sm font-bold text-ocean">
              {type === "private" ? t("form.pricePrivate") : t("form.priceGroup")}
            </label>
            <div className="flex h-12 items-center overflow-hidden rounded-2xl border-[1.5px] border-line bg-white focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15">
              <input
                id="price"
                inputMode="numeric"
                dir="ltr"
                value={price ? formatNumber(Number(price), locale) : ""}
                onChange={(e) =>
                  setPrice(toLatinDigits(e.target.value).replace(/\D/g, "").slice(0, 10))
                }
                aria-invalid={err("price") ? true : undefined}
                className="h-full min-w-0 flex-1 px-4 text-end text-lg font-bold text-ocean outline-none"
              />
              <span className="flex h-full items-center border-s border-mist bg-surface px-4 font-semibold">
                {t("form.toman")}
              </span>
            </div>
            <p className={`text-sm ${err("price") ? "font-medium text-red-700" : "text-body/80"}`}>
              {err("price") ??
                (priceValue > 0 &&
                  (type === "private"
                    ? t("form.priceHintPrivate", {
                        count: n(sessionCount),
                        total: formatToman(priceValue * sessionCount, locale),
                      })
                    : t("form.priceHintGroup", { count: n(sessionCount) })))}
            </p>
          </div>
        </section>

        <section aria-labelledby="sec-display" className={section}>
          <h2 id="sec-display" className={heading}>
            {t("form.sectionDisplay")}
          </h2>
          <TextareaField
            label={t("form.description")}
            name="description"
            defaultValue={defaults.description ?? ""}
            hint={t("form.descriptionHint")}
            error={err("description")}
          />
          {type === "group" && (
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                name="isPublic"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="mt-1 size-4.5 accent-brand"
              />
              <span className="leading-snug">
                <span className="block font-bold text-ocean">{t("form.isPublic")}</span>
                <span className="text-sm">{t("form.isPublicHint")}</span>
              </span>
            </label>
          )}
        </section>
      </div>
      <div hidden={step !== 2} className="space-y-5">
        <section aria-labelledby="sec-path" className={section}>
          <h2 id="sec-path" className={heading}>
            {tp("title")}{" "}
            <span className="text-sm font-medium text-body">{t("form.optional")}</span>
          </h2>
          <PathEditor
            level={level}
            sources={sources}
            sessionCount={sessionCount}
            start={null}
            optional
          />
        </section>
      </div>
      <div hidden={step !== 3} className="space-y-5">
        <section aria-labelledby="sec-schedule" className={section}>
          <h2 id="sec-schedule" className={heading}>
            {t("form.sectionSchedule")}
          </h2>
          <ScheduleFields
            count={count}
            setCount={setCount}
            minutes={minutes}
            setMinutes={setMinutes}
            slots={slots}
            setSlots={setSlots}
            startsOn={startsOn}
            setStartsOn={setStartsOn}
            today={today}
            err={err}
            last={last?.startsAt}
            validCount={validSlots.length}
          />
        </section>
      </div>
      <div hidden={step !== 4} className="space-y-5">
        <section aria-labelledby="sec-learners" className={section}>
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="sec-learners" className={heading}>
              {t("form.sectionLearners")}
            </h2>
            <strong className="text-ocean">
              {t("form.learnersCount", { count: n(shownPicks.length), capacity: n(seats) })}
            </strong>
          </div>
          {shownPicks.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {shownPicks.map((id) => {
                const person = candidates.find((c) => c.id === id);
                if (!person) return null;
                const { primary } = learnerNames(person, locale);
                return (
                  <li
                    key={id}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-pill bg-mist ps-4 pe-1.5 font-bold text-ocean"
                  >
                    {primary}
                    <button
                      type="button"
                      aria-label={t("form.removeLearner", { name: primary })}
                      onClick={() => setPicks(picks.filter((p) => p !== id))}
                      className="grid size-7 place-items-center rounded-full bg-white text-body"
                    >
                      <X aria-hidden size={14} weight="bold" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {shownPicks.length < seats ? (
            <Combobox
              label={t("form.learnersSearch")}
              labelHidden
              placeholder={t("form.learnersPlaceholder")}
              clearLabel={t("form.clear")}
              items={learnerItems(
                candidates.filter((c) => !picks.includes(c.id)),
                locale,
                (s) => ts(s),
              )}
              onPick={(item) => setPicks([...shownPicks, item.id])}
              empty={(query) => t("form.noMatch", { query })}
            />
          ) : null}
          <p
            className={`text-sm ${err("studentIds") ? "font-medium text-red-700" : "text-body/80"}`}
          >
            {err("studentIds") ??
              (shownPicks.length < seats ? t("form.learnersHint") : t("form.learnersFull"))}
          </p>
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {stepBlocked && (
          <p className="me-auto text-sm font-medium text-cinnamon-ink">
            {t(`form.need.${STEPS[step - 1]}`)}
          </p>
        )}
        {step === 1 ? (
          <Link href="/admin/classes" className={buttonClass("ghost")}>
            {t("form.cancel")}
          </Link>
        ) : (
          <button type="button" onClick={() => setStep(step - 1)} className={buttonClass("ghost")}>
            {t("form.back")}
          </button>
        )}
        {step < STEPS.length ? (
          <button
            type="button"
            disabled={stepBlocked}
            onClick={() => {
              setStep(step + 1);
              setMaxStep(Math.max(maxStep, step + 1));
            }}
            className={buttonClass("primary", "w-full sm:w-auto")}
          >
            {t(`form.next.${STEPS[step]}`)}
          </button>
        ) : (
          <SubmitButton pendingLabel={t("form.creating")} className="w-full sm:w-auto">
            {t("form.create")}
          </SubmitButton>
        )}
      </div>
    </form>
  );
}
