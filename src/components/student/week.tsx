"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatDayParts, fromTehranTime, tehranDateKey } from "@/lib/format";
import { addDays } from "@/lib/schedule";
import type { LearnerSession } from "@/server/scheduling/learner";
import { SessionCard } from "./schedule";

/**
 * The learner's week, read-only, in the teacher calendar's layout: seven columns on desktop, a
 * row of days with one day's sessions on a phone.
 */
export function LearnerWeek({
  start,
  today,
  sessions,
}: {
  /** Saturday, "YYYY-MM-DD" (Tehran). */
  start: string;
  today: string;
  sessions: LearnerSession[];
}) {
  const t = useTranslations("Student.schedule");
  const locale = useLocale() as Locale;
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const [mobileDay, setMobileDay] = useState(days.includes(today) ? today : start);
  const onDay = (day: string) => sessions.filter((s) => tehranDateKey(s.startsAt) === day);
  const noon = (day: string) => fromTehranTime(day, "12:00");

  const column = (day: string, compact: boolean) => {
    const list = onDay(day);
    return (
      <section
        aria-label={formatDate(noon(day), locale, { year: false })}
        className={`flex flex-col gap-1.5 ${compact ? "mt-2" : ""} ${
          compact && day === today ? "rounded-2xl bg-brand/[.07] p-1.5" : ""
        }`}
      >
        {list.map((s) => (
          <SessionCard
            key={s.id}
            session={s}
            isToday={day === today}
            locale={locale}
            compact={compact}
          />
        ))}
        {list.length === 0 && (
          <p className={`text-center font-bold text-line ${compact ? "py-2 text-sm" : "py-6"}`}>
            {t("emptyDay")}
          </p>
        )}
      </section>
    );
  };

  return (
    <>
      {/* Phone: one day at a time. */}
      <div className="space-y-3 lg:hidden">
        <div role="group" aria-label={t("days")} className="grid grid-cols-7 gap-1.5">
          {days.map((day) => {
            const parts = formatDayParts(noon(day), locale);
            const count = onDay(day).filter((s) => s.phase !== "cancelled").length;
            return (
              <button
                key={day}
                type="button"
                aria-pressed={day === mobileDay}
                onClick={() => setMobileDay(day)}
                className={`flex min-h-16 flex-col items-center justify-center rounded-2xl border text-sm leading-tight ${
                  day === mobileDay
                    ? "border-ocean bg-ocean text-white"
                    : day === today
                      ? "border-brand bg-white text-ocean"
                      : "border-hairline bg-white text-ocean"
                }`}
              >
                <small className="text-[11px] opacity-80">{parts.weekday}</small>
                <b className="text-base">{parts.day}</b>
                <span aria-hidden="true" className="flex h-1.5 gap-0.5">
                  {Array.from({ length: Math.min(count, 4) }, (_, i) => (
                    <span key={i} className="size-1.5 rounded-full bg-current opacity-60" />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
        {column(mobileDay, false)}
      </div>

      {/* Desktop: the whole week side by side. */}
      <div className="hidden grid-cols-7 items-start gap-2 lg:grid">
        {days.map((day) => {
          const isToday = day === today;
          return (
            <div key={day} className="min-w-0">
              <div
                className={`flex flex-col rounded-2xl border px-2 py-2 text-center leading-normal ${
                  isToday ? "border-ocean bg-ocean text-white" : "border-hairline bg-white"
                }`}
              >
                <small className={`text-[11px] ${isToday ? "text-whale" : "text-body"}`}>
                  {formatDate(noon(day), locale, { weekday: false, year: false })}
                </small>
                <b className="text-[15px] font-black">
                  {formatDayParts(noon(day), locale).weekday}
                </b>
              </div>
              {column(day, true)}
            </div>
          );
        })}
      </div>
    </>
  );
}
