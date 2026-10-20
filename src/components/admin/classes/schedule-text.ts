import type { Locale } from "@/i18n/routing";
import { localDigits } from "@/lib/format";
import { formatClock, type WeeklySlot } from "@/lib/schedule";

/**
 * "Sat & Mon · 08:00" when every day starts at the same time, else "Sat 18:00 · Mon 17:30".
 * `days` are the weekday names from `Admin.classes.weekdaysShort`.
 */
export function scheduleText(slots: WeeklySlot[], days: string[], and: string, locale: Locale) {
  if (slots.length === 0) return "";
  const times = new Set(slots.map((s) => s.minutes));
  const text =
    times.size === 1
      ? `${slots.map((s) => days[s.weekday]).join(and)} · ${formatClock(slots[0].minutes)}`
      : slots.map((s) => `${days[s.weekday]} ${formatClock(s.minutes)}`).join(" · ");
  return localDigits(text, locale);
}
