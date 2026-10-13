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
  return [weekday && p.weekday, p.day, p.month, year && p.year]
    .filter(Boolean)
    .join(" ");
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
