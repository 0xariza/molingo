"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { ErrorAlert } from "@/components/ui/alert";
import { Field, SelectField } from "@/components/ui/field";
import { FormSuccess } from "@/components/ui/form-success";
import { Honeypot } from "@/components/ui/honeypot";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatDayParts, formatTime, tehranDateKey } from "@/lib/format";
import { bookLevelCheckAction, type FormState } from "@/server/funnel/actions";

const LEVELS = ["unsure", "beginner", "intermediate", "advanced"] as const;
const DAYS_SHOWN = 14;
const DAY_MS = 24 * 60 * 60 * 1000;
const initial: FormState = { status: "idle" };

type Slot = { id: string; startsAt: string };

type Props = {
  /** Server time, so the server and the browser draw the same days. */
  now: string;
  slots: Slot[];
};

export function BookingForm({ now, slots }: Props) {
  const t = useTranslations("Landing.booking");
  const locale = useLocale() as Locale;
  const [state, action] = useActionState(bookLevelCheckAction, initial);

  const days = Array.from({ length: DAYS_SHOWN }, (_, i) => {
    const date = new Date(new Date(now).getTime() + i * DAY_MS);
    const key = tehranDateKey(date);
    return { key, date, slots: slots.filter((s) => tehranDateKey(new Date(s.startsAt)) === key) };
  });
  const firstOpen = days.find((d) => d.slots.length)?.key;
  const [dayKey, setDayKey] = useState(firstOpen);
  const [slotId, setSlotId] = useState<string>();

  // A slot that was just taken by someone else disappears from `slots` after the refresh.
  const selected = slots.find((s) => s.id === slotId);
  const day = days.find((d) => d.key === dayKey);
  const when = (s: Slot) => {
    const date = new Date(s.startsAt);
    return { date: formatDate(date, locale, { year: false }), time: formatTime(date, locale) };
  };

  if (state.status === "success" && selected) {
    return <FormSuccess>{t("success", when(selected))}</FormSuccess>;
  }
  if (!firstOpen) return <p className="py-6 text-lg font-semibold text-ocean">{t("noSlots")}</p>;

  const err = (field: string) => {
    const key = state.fieldErrors?.[field];
    return key ? t(`errors.${key as "name"}`) : undefined;
  };
  const v = state.values ?? {};

  return (
    <div className="space-y-6">
      {state.error && <ErrorAlert>{t(`errors.${state.error as "slot_taken"}`)}</ErrorAlert>}

      <fieldset className="space-y-3">
        <legend className="flex w-full items-baseline justify-between gap-3 font-extrabold text-ocean">
          {t("dayLabel")}
          <span className="text-sm font-normal text-body">{t("timeZone")}</span>
        </legend>
        <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 sm:grid sm:grid-cols-7 sm:overflow-visible">
          {days.map((d) => {
            const parts = formatDayParts(d.date, locale);
            const open = d.slots.length > 0;
            const active = d.key === dayKey;
            return (
              <button
                key={d.key}
                type="button"
                disabled={!open}
                aria-pressed={active}
                aria-label={formatDate(d.date, locale, { year: false })}
                onClick={() => {
                  setDayKey(d.key);
                  setSlotId(undefined);
                }}
                className={`flex min-h-16 min-w-14 shrink-0 snap-start flex-col items-center justify-center rounded-2xl text-xs transition ${
                  active
                    ? "bg-ocean text-white"
                    : open
                      ? "bg-mist text-brand hover:bg-whale/50"
                      : "cursor-not-allowed border border-mist text-body/50"
                }`}
              >
                <span>{parts.weekday}</span>
                <span className="text-lg font-extrabold leading-tight">{parts.day}</span>
                <span className="opacity-80">{parts.month}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {day && (
        <fieldset className="space-y-3">
          <legend className="font-extrabold text-ocean">
            {t("timeLabel")}
            <span className="font-normal text-body">
              {" · "}
              {formatDate(day.date, locale, { year: false })}
            </span>
          </legend>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {day.slots.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={s.id === slotId}
                onClick={() => setSlotId(s.id)}
                className={`min-h-touch rounded-2xl font-bold transition ${
                  s.id === slotId
                    ? "bg-sand text-ocean"
                    : "border border-mist bg-white text-ocean hover:border-brand"
                }`}
              >
                {formatTime(new Date(s.startsAt), locale)}
              </button>
            ))}
          </div>
          {err("slotId") && <p className="text-sm font-medium text-red-700">{err("slotId")}</p>}
        </fieldset>
      )}

      {selected ? (
        <form action={action} className="relative space-y-4 border-t border-mist pt-5" noValidate>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="slotId" value={selected.id} />
          <Honeypot />
          <p className="rounded-2xl bg-mist px-4 py-3 font-semibold text-ocean">
            {t("summary", when(selected))}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t("name")}
              name="name"
              autoComplete="name"
              required
              defaultValue={v.name}
              error={err("name")}
            />
            <Field
              label={t("phone")}
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              required
              defaultValue={v.phone}
              hint={t("phoneHint")}
              error={err("phone")}
              className="rtl:text-end"
            />
          </div>
          <SelectField
            label={t("level")}
            name="levelGuess"
            defaultValue={v.levelGuess || "unsure"}
            error={err("levelGuess")}
            options={LEVELS.map((value) => ({ value, label: t(`levels.${value}`) }))}
          />
          <SubmitButton pendingLabel={t("sending")}>{t("submit")}</SubmitButton>
        </form>
      ) : (
        <p className="text-sm">{t("pickTime")}</p>
      )}
    </div>
  );
}
