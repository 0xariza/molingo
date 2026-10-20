import type { Locale } from "@/i18n/routing";

type Names = { fullNameFa: string; fullNameEn: string | null };

/** The name to lead with in this locale, and the other spelling (if any) to show under it. */
export function learnerNames({ fullNameFa, fullNameEn }: Names, locale: Locale) {
  if (locale === "en" && fullNameEn) return { primary: fullNameEn, secondary: fullNameFa };
  return { primary: fullNameFa, secondary: fullNameEn };
}

/** Bookings keep one name as typed; it prefills the Persian or English field by its script. */
export function splitBookingName(name: string): Names {
  return /[؀-ۿ]/.test(name)
    ? { fullNameFa: name, fullNameEn: null }
    : { fullNameFa: "", fullNameEn: name };
}

/** A class's name in this locale: the English name in English when there is one. */
export function classTitle(c: { nameFa: string; nameEn: string | null }, locale: Locale): string {
  return locale === "en" && c.nameEn ? c.nameEn : c.nameFa;
}

/** One of Mona's busy times: a class session, or a level-check time she opened. */
export type BusyLike =
  { kind: "class"; nameFa: string; nameEn: string | null } | { kind: "levelCheck" };

/** What a busy time is called: its class's name, or the level-check label passed in. */
export function busyTitle(b: BusyLike, locale: Locale, levelCheck: string): string {
  return b.kind === "levelCheck" ? levelCheck : classTitle(b, locale);
}
