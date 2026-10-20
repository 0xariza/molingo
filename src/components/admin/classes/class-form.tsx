"use client";

import { Clock, Minus, Plus, Trash, X } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { ErrorAlert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import { Field, TextareaField } from "@/components/ui/field";
import { SelectMenu } from "@/components/ui/select-menu";
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
import {
  formatClock,
  parseClock,
  sessionTimes,
  weekdayOf,
  WEEKDAYS,
  type Weekday,
} from "@/lib/schedule";
import { createClassAction, type ClassFormState } from "@/server/classes/actions";
import type { CefrLevel } from "@/server/classes/classes";
import { learnerItems, type Candidate } from "./learner-picker-items";
import { LevelPicker } from "./level-picker";

const LENGTHS = [30, 45, 60, 75, 90, 120];

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

/** Day · start time · ends · remove, one line per weekly session. */
const slotGrid =
  "grid grid-cols-[minmax(0,1fr)_8rem_2.75rem] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_5rem_2.75rem]";
const section = "space-y-5 rounded-[1.75rem] border border-line/40 bg-white p-6 sm:p-7";
const heading = "font-sans text-lg font-extrabold normal-case tracking-normal";
const segment =
  "min-h-13 rounded-xl px-3 font-bold leading-tight text-body transition aria-pressed:bg-white aria-pressed:text-ocean aria-pressed:shadow-[0_1px_3px_rgba(7,30,54,.12)]";

/** New class (or the next course of a finished one): class, schedule, tuition, learners, display. */
export function ClassForm({
  defaults,
  candidates,
  today,
  fromClassId,
}: {
  defaults: ClassFormDefaults;
  candidates: Candidate[];
  /** Tehran date "YYYY-MM-DD"; earlier days can't start a class. */
  today: string;
  fromClassId?: string;
}) {
  const t = useTranslations("Admin.classes");
  const ts = useTranslations("Admin.learners.status");
  const locale = useLocale() as Locale;
  const [state, action] = useActionState(createClassAction, initial);
  const days = t.raw("weekdays") as string[];
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
  const freeDay = WEEKDAYS.find((d) => !slots.some((s) => s.weekday === d));
  const shownPicks = picks.slice(0, seats);

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

      <section aria-labelledby="sec-schedule" className={section}>
        <h2 id="sec-schedule" className={heading}>
          {t("form.sectionSchedule")}
        </h2>
        <div className="grid items-start gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="session-count" className="block text-sm font-bold text-ocean">
              {t("form.sessionCount")}
            </label>
            <div className="flex h-12 items-center overflow-hidden rounded-2xl border-[1.5px] border-line bg-white focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15">
              <button
                type="button"
                aria-label={t("form.less")}
                onClick={() => setCount(String(Math.max(1, sessionCount - 1)))}
                className="grid h-full w-13 place-items-center text-brand hover:bg-surface"
              >
                <Minus aria-hidden size={18} weight="bold" />
              </button>
              <input
                id="session-count"
                inputMode="numeric"
                dir="ltr"
                maxLength={2}
                value={localDigits(count, locale)}
                onChange={(e) => setCount(toLatinDigits(e.target.value).replace(/\D/g, ""))}
                aria-invalid={err("sessionCount") ? true : undefined}
                className="h-full min-w-0 flex-1 border-x border-mist text-center text-lg font-extrabold text-ocean outline-none"
              />
              <button
                type="button"
                aria-label={t("form.more")}
                onClick={() => setCount(String(Math.min(60, sessionCount + 1)))}
                className="grid h-full w-13 place-items-center text-brand hover:bg-surface"
              >
                <Plus aria-hidden size={18} weight="bold" />
              </button>
            </div>
            <p
              className={`text-sm ${err("sessionCount") ? "font-medium text-red-700" : "text-body/80"}`}
            >
              {err("sessionCount") ?? t("form.sessionCountHint")}
            </p>
          </div>
          <SelectMenu
            label={t("form.sessionMinutes")}
            name="sessionMinutes"
            value={minutes}
            onChange={setMinutes}
            error={err("sessionMinutes")}
            options={LENGTHS.map((m) => ({
              value: String(m),
              label: t("form.minutesOption", { count: n(m) }),
            }))}
          />
        </div>

        <fieldset className="space-y-2.5">
          <legend className="text-sm font-bold text-ocean">{t("form.slots")}</legend>
          <p className="text-sm">{t("form.slotsHint")}</p>
          {slots.length > 0 && (
            <div
              aria-hidden="true"
              className={`${slotGrid} px-2.5 pt-1 text-sm font-bold text-ocean`}
            >
              <span>{t("form.colDay")}</span>
              <span>{t("form.colTime")}</span>
              <span className="hidden sm:block">{t("form.colEnds")}</span>
            </div>
          )}
          {slots.map((slot, i) => {
            const m = parseClock(slot.time);
            const bad = slot.time.trim() !== "" && m === null;
            return (
              <div
                key={slot.weekday}
                className={`${slotGrid} rounded-2xl border border-mist bg-surface/60 p-2.5`}
              >
                <SelectMenu
                  label={t("form.dayLabel", { n: n(i + 1) })}
                  labelHidden
                  value={String(slot.weekday)}
                  onChange={(v) =>
                    setSlots(
                      slots.map((s, j) => (j === i ? { ...s, weekday: Number(v) as Weekday } : s)),
                    )
                  }
                  options={WEEKDAYS.map((d) => ({
                    value: String(d),
                    label: days[d],
                    disabled: d !== slot.weekday && slots.some((s) => s.weekday === d),
                    hint:
                      d !== slot.weekday && slots.some((s) => s.weekday === d)
                        ? t("form.dayTaken")
                        : undefined,
                  }))}
                />
                <div
                  className={`flex h-12 items-center gap-2 rounded-2xl border-[1.5px] bg-white px-3 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15 ${bad ? "border-red-600" : "border-line"}`}
                >
                  <label htmlFor={`slot-time-${i}`} className="sr-only">
                    {t("form.timeLabel", { day: days[slot.weekday] })}
                  </label>
                  <Clock aria-hidden size={18} className="shrink-0 text-body" />
                  <input
                    id={`slot-time-${i}`}
                    inputMode="numeric"
                    dir="ltr"
                    maxLength={5}
                    placeholder={t("form.timePlaceholder")}
                    value={slot.time}
                    aria-invalid={bad || undefined}
                    onChange={(e) =>
                      setSlots(slots.map((s, j) => (j === i ? { ...s, time: e.target.value } : s)))
                    }
                    className="min-w-0 flex-1 bg-transparent text-center font-bold text-ocean outline-none placeholder:font-medium placeholder:text-body/50"
                  />
                </div>
                <p className="hidden text-sm sm:block">
                  {m !== null ? localDigits(formatClock(m + Number(minutes)), locale) : "—"}
                </p>
                <button
                  type="button"
                  aria-label={t("form.removeSlot", { day: days[slot.weekday] })}
                  onClick={() => setSlots(slots.filter((_, j) => j !== i))}
                  className="grid size-11 place-items-center rounded-xl text-red-700 hover:bg-red-50"
                >
                  <Trash aria-hidden size={20} />
                </button>
              </div>
            );
          })}
          {freeDay !== undefined && (
            <button
              type="button"
              onClick={() => setSlots([...slots, { weekday: freeDay, time: "" }])}
              className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-whale bg-white font-extrabold text-brand hover:border-brand hover:bg-surface"
            >
              <Plus aria-hidden size={18} weight="bold" />
              {t("form.addSlot")}
            </button>
          )}
          {err("slots") && <p className="text-sm font-medium text-red-700">{err("slots")}</p>}
        </fieldset>

        <div className="grid items-start gap-5 sm:grid-cols-2">
          <DatePicker
            label={t("form.startsOn")}
            name="startsOn"
            value={startsOn}
            onChange={setStartsOn}
            placeholder={t("form.startsOnPlaceholder")}
            disabled={slots.length === 0}
            allowed={(key) => key >= today && slots.some((s) => s.weekday === weekdayOf(key))}
            hint={slots.length ? t("form.startsOnHint") : t("form.lastSessionNoSlots")}
            error={err("startsOn")}
          />
          <div className="space-y-1.5">
            <span className="block text-sm font-bold text-ocean">{t("form.lastSession")}</span>
            <p className="flex h-12 items-center rounded-2xl border border-dashed border-line/60 bg-surface px-4 font-bold text-ocean">
              {last
                ? formatDate(last.startsAt, locale)
                : slots.length === 0
                  ? t("form.lastSessionNoSlots")
                  : validSlots.length < slots.length
                    ? t("form.lastSessionNoTime")
                    : t("form.lastSessionNoStart")}
            </p>
            <p className="text-sm text-body/80">{t("form.lastSessionHint")}</p>
          </div>
        </div>
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

      <section aria-labelledby="sec-learners" className={section}>
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="sec-learners" className={heading}>
            {t("form.sectionLearners")}{" "}
            <span className="text-base font-medium text-body">
              {t("form.sectionLearnersOptional")}
            </span>
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
        <p className={`text-sm ${err("studentIds") ? "font-medium text-red-700" : "text-body/80"}`}>
          {err("studentIds") ??
            (shownPicks.length < seats ? t("form.learnersHint") : t("form.learnersFull"))}
        </p>
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

      <div className="flex flex-wrap justify-end gap-3">
        <Link href="/admin/classes" className={buttonClass("ghost")}>
          {t("form.cancel")}
        </Link>
        <SubmitButton pendingLabel={t("form.creating")} className="w-full sm:w-auto">
          {t("form.create")}
        </SubmitButton>
      </div>
    </form>
  );
}
