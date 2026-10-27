"use client";

import { Plus } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { Fragment, useState, type CSSProperties } from "react";
import type { Locale } from "@/i18n/routing";
import {
  formatDate,
  formatDayParts,
  formatNumber,
  formatTime,
  fromTehranTime,
  localDigits,
  tehranDateKey,
} from "@/lib/format";
import { addDays, busyMinutes, formatHours } from "@/lib/schedule";
import { isBusy, PILL_STYLE, useItemText, type CalendarItem, type WeekData } from "./calendar-item";
import { ACCENT } from "./colors";
import { ScheduleDialog, type Selection } from "./schedule-dialog";

/** Mona's week: hours against her limits, the seven days with every session and level-check time. */
export function WeekView(data: WeekData) {
  const { start, today, sessions, levelChecks, limits } = data;
  const t = useTranslations("Admin.schedule");
  const locale = useLocale() as Locale;
  const [selection, setSelection] = useState<Selection | null>(null);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const [mobileDay, setMobileDay] = useState(days.includes(today) ? today : start);

  const items: CalendarItem[] = [
    ...sessions.map((s) => ({
      kind: "session" as const,
      id: s.id,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      session: s,
    })),
    ...levelChecks.map((c) => ({
      kind: "levelCheck" as const,
      id: c.id,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      slot: c,
    })),
  ].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const busy = items.filter(isBusy);
  const onDay = (key: string) => items.filter((i) => tehranDateKey(i.startsAt) === key);
  const hours = (minutes: number) => localDigits(formatHours(minutes), locale);
  const total = busyMinutes(busy);
  const open = (item: CalendarItem) => setSelection({ type: "item", item });
  const add = (day: string) => setSelection({ type: "add", day });

  return (
    <>
      <section
        aria-labelledby="week-hours"
        className="space-y-2.5 rounded-card border border-hairline bg-white px-5 py-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <p className="flex items-baseline gap-3">
            <strong id="week-hours">{t("hoursTitle")}</strong>
            <span>
              {t.rich("hoursOf", {
                used: hours(total),
                limit: formatNumber(limits.week / 60, locale),
                b: (chunks) => <b className="text-xl font-black tabular-nums">{chunks}</b>,
              })}
            </span>
          </p>
          <Legend />
        </div>
        <Meter used={total} limit={limits.week} className="h-2.5" label={t("hoursTitle")} />
      </section>

      {/* Phone: one day at a time. */}
      <div className="space-y-3 lg:hidden">
        <div role="group" aria-label={t("days")} className="grid grid-cols-7 gap-1.5">
          {days.map((day) => {
            const parts = formatDayParts(fromTehranTime(day, "12:00"), locale);
            const count = onDay(day).filter(isBusy).length;
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
        <DayColumn
          day={mobileDay}
          items={onDay(mobileDay)}
          data={data}
          onOpen={open}
          onAdd={mobileDay >= today ? () => add(mobileDay) : undefined}
          roomy
        />
      </div>

      {/* Desktop: the whole week side by side. */}
      <div className="hidden grid-cols-7 items-start gap-2 lg:grid">
        {days.map((day) => {
          const isToday = day === today;
          const parts = formatDayParts(fromTehranTime(day, "12:00"), locale);
          const minutes = busyMinutes(busy, day);
          return (
            <div key={day} className="min-w-0">
              <div
                className={`flex flex-col rounded-2xl border px-2 pt-2 pb-1.5 text-center leading-normal ${
                  isToday ? "border-ocean bg-ocean text-white" : "border-hairline bg-white"
                }`}
              >
                <small className={`text-[11px] ${isToday ? "text-whale" : "text-body"}`}>
                  {formatDate(fromTehranTime(day, "12:00"), locale, {
                    weekday: false,
                    year: false,
                  })}
                </small>
                <b className="text-[15px] font-black">{parts.weekday}</b>
                <Meter
                  used={minutes}
                  limit={limits.day}
                  className="mt-1.5 h-1"
                  label={t("dayHours", {
                    used: hours(minutes),
                    limit: formatNumber(limits.day / 60, locale),
                  })}
                  dark={isToday}
                />
              </div>
              <DayColumn
                day={day}
                items={onDay(day)}
                data={data}
                onOpen={open}
                onAdd={day >= today ? () => add(day) : undefined}
              />
            </div>
          );
        })}
      </div>

      {selection && (
        <ScheduleDialog
          selection={selection}
          data={data}
          items={items}
          onClose={() => setSelection(null)}
          onSelect={setSelection}
        />
      )}
    </>
  );
}

function Legend() {
  const t = useTranslations("Admin.schedule");
  const keys = [
    ["group", ACCENT.group],
    ["private", ACCENT.private],
    ["makeup", ACCENT.makeup],
    ["levelCheck", ACCENT.levelCheck],
    ["open", null],
    ["cancelled", ACCENT.cancelled],
  ] as const;
  return (
    <ul
      aria-label={t("legendLabel")}
      className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-body"
    >
      {keys.map(([key, color]) => (
        <li key={key} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={`inline-block size-3 rounded-[3px] ${color ? "" : "border-[1.5px] border-dashed border-whale"}`}
            style={color ? { background: color } : undefined}
          />
          {t(`legend.${key}`)}
        </li>
      ))}
    </ul>
  );
}

function Meter({
  used,
  limit,
  label,
  className,
  dark = false,
}: {
  used: number;
  limit: number;
  label: string;
  className: string;
  dark?: boolean;
}) {
  const over = used > limit;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={limit}
      aria-valuenow={Math.min(used, limit)}
      className={`overflow-hidden rounded-full ${dark ? "bg-whale/25" : "bg-mist"} ${className}`}
    >
      <div
        className={`h-full rounded-full ${over ? "bg-red-700" : dark ? "bg-whale" : "bg-brand"}`}
        style={{ width: `${Math.min(100, (used / limit) * 100)}%` }}
      />
    </div>
  );
}

function DayColumn({
  day,
  items,
  data,
  onOpen,
  onAdd,
  roomy = false,
}: {
  day: string;
  items: CalendarItem[];
  data: WeekData;
  onOpen: (item: CalendarItem) => void;
  /** Only today and later: past times can't be booked. */
  onAdd?: () => void;
  roomy?: boolean;
}) {
  const t = useTranslations("Admin.schedule");
  const locale = useLocale() as Locale;
  const isToday = day === data.today;
  const nowAt = isToday ? items.findIndex((i) => i.startsAt >= data.now) : -2;
  const nowLine = (
    <p
      role="note"
      className="flex items-center gap-1.5 text-[11px] font-extrabold text-red-700 before:size-1.5 before:rounded-full before:bg-red-700 after:h-0.5 after:flex-1 after:rounded-full after:bg-red-700"
    >
      {t("now", { time: formatTime(data.now, locale) })}
    </p>
  );
  return (
    <div
      className={`flex flex-col gap-1.5 ${roomy ? "" : "mt-2"} ${isToday && !roomy ? "rounded-2xl bg-brand/[.07] p-1.5" : ""}`}
    >
      {items.map((item, i) => (
        <Fragment key={item.id}>
          {i === nowAt && nowLine}
          <Card item={item} data={data} onOpen={() => onOpen(item)} roomy={roomy} />
        </Fragment>
      ))}
      {isToday && nowAt === -1 && items.length > 0 && nowLine}
      {items.length === 0 && (
        <p className={`text-center font-bold text-line ${roomy ? "py-6" : "py-2 text-sm"}`}>
          {t("emptyDay")}
        </p>
      )}
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className={`flex items-center justify-center gap-1 rounded-xl border border-dashed border-line/60 font-bold text-line hover:border-brand hover:bg-white hover:text-brand ${roomy ? "min-h-12" : "min-h-8 text-xs"}`}
        >
          <Plus aria-hidden size={roomy ? 16 : 12} weight="bold" />
          {roomy ? t("addSlotLong") : t("addSlot")}
        </button>
      )}
    </div>
  );
}

function Card({
  item,
  data,
  onOpen,
  roomy,
}: {
  item: CalendarItem;
  data: WeekData;
  onOpen: () => void;
  roomy: boolean;
}) {
  const t = useTranslations("Admin.schedule");
  const text = useItemText(item, data);
  const cancelled = item.kind === "session" && item.session.phase === "cancelled";
  const live = item.kind === "session" && item.session.phase === "live";
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${text.fullTitle} · ${text.time}`}
      style={text.color ? ({ "--accent": text.color } as CSSProperties) : undefined}
      className={`relative flex w-full flex-col gap-px overflow-hidden rounded-xl text-start text-ocean ${
        roomy ? "px-4 py-2.5" : "py-1.5 ps-2 pe-2.5"
      } ${
        text.color
          ? `border bg-white before:absolute before:inset-y-0 before:start-0 before:w-1 before:bg-(--accent) hover:border-brand ${live ? "border-ocean ring-1 ring-ocean" : "border-hairline"}`
          : "border-[1.5px] border-dashed border-whale hover:bg-white"
      } ${cancelled ? "[&>*]:opacity-55" : ""}`}
    >
      <span className="flex flex-wrap items-center justify-between gap-x-1 gap-y-0.5">
        <span
          className={`font-bold whitespace-nowrap text-brand tabular-nums ${roomy ? "text-sm" : "text-[11.5px]"}`}
        >
          {text.time}
        </span>
        {text.pill && (
          <span
            className={`rounded-pill px-1.5 text-[10px] leading-relaxed font-extrabold whitespace-nowrap ${PILL_STYLE[text.pill]}`}
          >
            {t(`pill.${text.pill}`)}
          </span>
        )}
      </span>
      <span
        className={`truncate font-extrabold ${roomy ? "text-base" : "text-[13px]"} ${cancelled ? "line-through" : ""} ${text.color ? "" : "text-brand"}`}
      >
        {text.title}
      </span>
      {text.meta && <span className="truncate text-[11px] text-body">{text.meta}</span>}
    </button>
  );
}
