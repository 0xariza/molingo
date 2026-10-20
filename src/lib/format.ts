import { TZDate } from "@date-fns/tz";
import type { Locale } from "@/i18n/routing";

export const TEHRAN = "Asia/Tehran";

const intlLocale: Record<Locale, string> = {
  // Persian calendar and Persian digits are the `fa` defaults; set them explicitly anyway.
  fa: "fa-IR-u-ca-persian-nu-arabext",
  en: "en-GB-u-ca-gregory-nu-latn",
};

function parts(date: Date, locale: Locale, options: Intl.DateTimeFormatOptions) {
  const out: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
  for (const p of new Intl.DateTimeFormat(intlLocale[locale], {
    timeZone: TEHRAN,
    ...options,
  }).formatToParts(date)) {
    out[p.type] = p.value;
  }
  return out;
}

/** "سه‌شنبه ۲۱ مهر ۱۴۰۵" / "Tue 13 Oct 2026" (Tehran date). */
export function formatDate(
  date: Date,
  locale: Locale,
  { weekday = true, year = true }: { weekday?: boolean; year?: boolean } = {},
): string {
  const p = parts(date, locale, {
    weekday: locale === "fa" ? "long" : "short",
    day: "numeric",
    month: locale === "fa" ? "long" : "short",
    year: "numeric",
  });
  return [weekday && p.weekday, p.day, p.month, year && p.year].filter(Boolean).join(" ");
}

/** Weekday, day and month as separate labels, for calendar chips ("سه‌شنبه", "۲۱", "مهر"). */
export function formatDayParts(date: Date, locale: Locale) {
  const p = parts(date, locale, { weekday: "short", day: "numeric", month: "long" });
  return { weekday: p.weekday ?? "", day: p.day ?? "", month: p.month ?? "" };
}

/** The Tehran calendar day of an instant, as "YYYY-MM-DD" (Gregorian), for grouping by day. */
export function tehranDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TEHRAN,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** The instant of a Tehran wall-clock time: ("2026-10-13", "18:00") → 14:30 UTC. */
export function fromTehranTime(dateKey: string, time: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return new Date(new TZDate(y, m - 1, d, h, min, TEHRAN).getTime());
}

/** "۱۸:۰۰" / "18:00" (Tehran time, 24-hour in both locales). */
export function formatTime(date: Date, locale: Locale): string {
  const p = parts(date, locale, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return `${p.hour}:${p.minute}`;
}

export function formatNumber(value: number | bigint, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale[locale]).format(value);
}

/** Amounts are stored as integer Toman. */
export function formatToman(amount: number | bigint, locale: Locale): string {
  const n = formatNumber(amount, locale);
  return locale === "fa" ? `${n} تومان` : `${n} Toman`;
}

/** Converts Persian (۰-۹) and Arabic-Indic (٠-٩) digits to ASCII. */
export function toLatinDigits(input: string): string {
  return input.replace(/[۰-۹٠-٩]/g, (d) => {
    const code = d.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

const jalaliParts = new Intl.DateTimeFormat("en-u-ca-persian-nu-latn", {
  timeZone: TEHRAN,
  year: "numeric",
  month: "2-digit",
  day: "numeric",
});

function jalali(date: Date) {
  const p = Object.fromEntries(jalaliParts.formatToParts(date).map((x) => [x.type, x.value]));
  return { year: p.year, month: p.month, day: Number(p.day) };
}

/** The Jalali month of an instant in Tehran, as "1405-07", for grouping by month. */
export function jalaliMonthKey(date: Date): string {
  const { year, month } = jalali(date);
  return `${year}-${month}`;
}

/** The last `count` Jalali months up to `now`'s, oldest first; `date` is 00:00 Tehran on the 1st. */
export function recentJalaliMonths(now: Date, count: number): { key: string; date: Date }[] {
  const DAY = 24 * 60 * 60 * 1000;
  const months: { key: string; date: Date }[] = [];
  let cursor = now;
  for (let i = 0; i < count; i++) {
    const day = new Date(cursor.getTime() - (jalali(cursor).day - 1) * DAY);
    const first = fromTehranTime(tehranDateKey(day), "00:00");
    months.unshift({ key: jalaliMonthKey(first), date: first });
    cursor = new Date(first.getTime() - DAY);
  }
  return months;
}

/** "مهر" / "Mehr": the Jalali month name in both locales (classes run on the Persian calendar). */
export function formatJalaliMonth(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "fa" ? intlLocale.fa : "en-u-ca-persian", {
    timeZone: TEHRAN,
    month: "long",
  }).format(date);
}

/** Persian digits in Persian ("18:30" → "۱۸:۳۰"); unchanged in English. */
export function localDigits(text: string, locale: Locale): string {
  return locale === "fa" ? text.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]) : text;
}
