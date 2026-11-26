"use client";

import { Clock, Minus, Plus, Trash } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { DatePicker } from "@/components/ui/date-picker";
import { SelectMenu } from "@/components/ui/select-menu";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatNumber, localDigits, toLatinDigits } from "@/lib/format";
import { formatClock, parseClock, weekdayOf, WEEKDAYS, type Weekday } from "@/lib/schedule";

const LENGTHS = [30, 45, 60, 75, 90, 120];

/** Day · start time · ends · remove, one line per weekly session. */
const slotGrid =
  "grid grid-cols-[minmax(0,1fr)_8rem_2.75rem] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_5rem_2.75rem]";

export type SlotDraft = { weekday: Weekday; time: string };

/**
 * Number of sessions, length, weekly days and times, first day and the last session, for the
 * new-class wizard and the class's schedule edit. The parent form posts `sessionCount` and `slots`.
 */
export function ScheduleFields({
  count,
  setCount,
  minutes,
  setMinutes,
  slots,
  setSlots,
  startsOn,
  setStartsOn,
  today,
  err,
  last,
  validCount,
  startsLabel,
  startsHint,
}: {
  count: string;
  setCount: (v: string) => void;
  minutes: string;
  setMinutes: (v: string) => void;
  slots: SlotDraft[];
  setSlots: (v: SlotDraft[]) => void;
  startsOn: string;
  setStartsOn: (v: string) => void;
  /** Tehran date "YYYY-MM-DD"; earlier days can't be picked. */
  today: string;
  err: (field: string) => string | undefined;
  /** The last session the schedule makes, when it is complete. */
  last: Date | undefined;
  /** Slots with a valid time. */
  validCount: number;
  startsLabel?: string;
  startsHint?: string;
}) {
  const t = useTranslations("Admin.classes");
  const locale = useLocale() as Locale;
  const n = (v: number) => formatNumber(v, locale);
  const days = t.raw("weekdays") as string[];
  const sessionCount = Number(toLatinDigits(count)) || 0;
  const freeDay = WEEKDAYS.find((d) => !slots.some((s) => s.weekday === d));

  return (
    <>
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
          label={startsLabel ?? t("form.startsOn")}
          name="startsOn"
          value={startsOn}
          onChange={setStartsOn}
          placeholder={t("form.startsOnPlaceholder")}
          disabled={slots.length === 0}
          allowed={(key) => key >= today && slots.some((s) => s.weekday === weekdayOf(key))}
          hint={
            slots.length ? (startsHint ?? t("form.startsOnHint")) : t("form.lastSessionNoSlots")
          }
          error={err("startsOn")}
        />
        <div className="space-y-1.5">
          <span className="block text-sm font-bold text-ocean">{t("form.lastSession")}</span>
          <p className="flex h-12 items-center rounded-2xl border border-dashed border-line/60 bg-surface px-4 font-bold text-ocean">
            {last
              ? formatDate(last, locale)
              : slots.length === 0
                ? t("form.lastSessionNoSlots")
                : validCount < slots.length
                  ? t("form.lastSessionNoTime")
                  : t("form.lastSessionNoStart")}
          </p>
          <p className="text-sm text-body/80">{t("form.lastSessionHint")}</p>
        </div>
      </div>
    </>
  );
}
