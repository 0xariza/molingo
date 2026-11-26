"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { ErrorAlert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatNumber, formatTime, localDigits } from "@/lib/format";
import { busyTitle } from "@/lib/names";
import { formatClock, parseClock, sessionTimes, weekdayOf, type Weekday } from "@/lib/schedule";
import { rescheduleClassAction, type ClassFormState } from "@/server/classes/actions";
import { ScheduleFields } from "./schedule-fields";

const initial: ClassFormState = { status: "idle" };

/** A new schedule for the sessions still to come; the ones already held or cancelled stay. */
export function EditScheduleForm({
  id,
  defaults,
  kept,
  today,
}: {
  id: string;
  defaults: {
    sessionCount: number;
    sessionMinutes: number;
    slots: { weekday: Weekday; minutes: number }[];
    /** The first day the new schedule applies. */
    startsOn: string;
  };
  /** Sessions held, cancelled or under way: they stay and count towards the total. */
  kept: number;
  today: string;
}) {
  const t = useTranslations("Admin.classes");
  const locale = useLocale() as Locale;
  const [state, action] = useActionState(rescheduleClassAction, initial);
  const [count, setCount] = useState(String(defaults.sessionCount));
  const [minutes, setMinutes] = useState(String(defaults.sessionMinutes));
  const [slots, setSlots] = useState(
    defaults.slots.map((s) => ({
      weekday: s.weekday,
      time: localDigits(formatClock(s.minutes), locale),
    })),
  );
  const [startsOn, setStartsOn] = useState(defaults.startsOn);

  const sessionCount = Number(count) || 0;
  const validSlots = slots.flatMap((s) => {
    const m = parseClock(s.time);
    return m === null ? [] : [{ weekday: s.weekday, minutes: m }];
  });
  const startOk = validSlots.some((s) => s.weekday === weekdayOf(startsOn || "2000-01-01"));
  const last =
    startOk && sessionCount > kept
      ? sessionTimes({
          startsOn,
          slots: validSlots,
          count: sessionCount - kept,
          sessionMinutes: Number(minutes),
        }).at(-1)?.startsAt
      : undefined;

  const err = (field: string) => {
    const key = state.fieldErrors?.[field];
    return key ? t(`errors.${key as "slots"}`) : undefined;
  };
  const formError =
    state.error === "clash"
      ? state.clash
        ? t("errors.clash", {
            name: busyTitle(state.clash, locale, t("levelCheck")),
            when: `${formatDate(new Date(state.clash.startsAt), locale, { year: false })} ${formatTime(new Date(state.clash.startsAt), locale)}`,
          })
        : t("errors.clashGeneric")
      : state.error === "too_few"
        ? t("errors.too_few", { min: formatNumber(state.min ?? kept, locale) })
        : state.error
          ? t(`errors.${state.error as "past"}`)
          : null;

  return (
    <form
      action={action}
      noValidate
      aria-labelledby="schedule-title"
      className="space-y-5 rounded-card border border-hairline bg-white p-6 sm:p-7"
    >
      <h2
        id="schedule-title"
        className="font-sans text-lg font-extrabold normal-case tracking-normal"
      >
        {t("form.sectionSchedule")}
      </h2>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="sessionCount" value={sessionCount || ""} />
      <input type="hidden" name="slots" value={JSON.stringify(slots)} />
      {formError && <ErrorAlert>{formError}</ErrorAlert>}
      <p className="rounded-2xl bg-surface px-4 py-3 text-sm">
        {t("form.scheduleNote", { kept: formatNumber(kept, locale) })}
      </p>
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
        last={last}
        validCount={validSlots.length}
        startsLabel={kept ? t("form.scheduleFrom") : undefined}
      />
      <div className="flex justify-end border-t border-mist pt-5">
        <SubmitButton pendingLabel={t("form.saving")} className="w-full sm:w-auto">
          {t("form.saveSchedule")}
        </SubmitButton>
      </div>
    </form>
  );
}
