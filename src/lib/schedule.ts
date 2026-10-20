import { fromTehranTime, tehranDateKey, toLatinDigits } from "./format";

/** Weekday 0 = Saturday … 6 = Friday (the Iranian week). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

const DAY_MS = 24 * 60 * 60 * 1000;

/** "18:30", "1830", "8:05", Persian digits → minutes after midnight, or null. */
export function parseClock(input: string): number | null {
  const m = toLatinDigits(input.trim())
    .replace(/[^\d:]/g, "")
    .match(/^(\d{1,2}):?(\d{2})$/);
  if (!m) return null;
  const [h, min] = [Number(m[1]), Number(m[2])];
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/** Minutes after midnight → "18:30" (wraps past midnight). */
export function formatClock(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** The weekday of a calendar date "YYYY-MM-DD". */
export function weekdayOf(dateKey: string): Weekday {
  return ((new Date(`${dateKey}T12:00:00Z`).getUTCDay() + 1) % 7) as Weekday;
}

export function addDays(dateKey: string, days: number): string {
  return new Date(new Date(`${dateKey}T12:00:00Z`).getTime() + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

export type WeeklySlot = { weekday: Weekday; minutes: number };

/**
 * The first `count` sessions on the weekly slots, from `startsOn` (inclusive), in Tehran time.
 * Returns fewer only if there are no slots.
 */
export function sessionTimes({
  startsOn,
  slots,
  count,
  sessionMinutes,
}: {
  startsOn: string;
  slots: WeeklySlot[];
  count: number;
  sessionMinutes: number;
}): { startsAt: Date; endsAt: Date }[] {
  if (slots.length === 0) return [];
  const byDay = new Map(slots.map((s) => [s.weekday, s.minutes]));
  const out: { startsAt: Date; endsAt: Date }[] = [];
  for (let day = 0; out.length < count; day++) {
    const dateKey = addDays(startsOn, day);
    const minutes = byDay.get(weekdayOf(dateKey));
    if (minutes === undefined) continue;
    const startsAt = fromTehranTime(dateKey, formatClock(minutes));
    out.push({ startsAt, endsAt: new Date(startsAt.getTime() + sessionMinutes * 60_000) });
  }
  return out;
}

/** The first date after `afterKey` that falls on one of the weekdays. */
export function nextDateOn(afterKey: string, weekdays: Weekday[]): string {
  for (let day = 1; day <= 7; day++) {
    const key = addDays(afterKey, day);
    if (weekdays.includes(weekdayOf(key))) return key;
  }
  return addDays(afterKey, 1);
}

/** The Saturday that starts the (Iranian, Sat–Fri) week of a date, moved by `weeks`. */
export function weekStartOf(dateKey: string, weeks = 0): string {
  return addDays(dateKey, weeks * 7 - weekdayOf(dateKey));
}

/** Total minutes of these spans; with `dateKey`, only those starting on that Tehran day. */
export function busyMinutes(spans: { startsAt: Date; endsAt: Date }[], dateKey?: string): number {
  return spans
    .filter((s) => !dateKey || tehranDateKey(s.startsAt) === dateKey)
    .reduce((sum, s) => sum + (s.endsAt.getTime() - s.startsAt.getTime()) / 60_000, 0);
}

/** Minutes as hours and minutes, "13:10" (Latin digits; localize for display). */
export function formatHours(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${String(Math.round(minutes % 60)).padStart(2, "0")}`;
}
