"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { formatTime, tehranDateKey } from "@/lib/format";
import { classTitle } from "@/lib/names";
import type { DaySession } from "@/server/classes/sessions";
import type { WaitingLead } from "@/server/funnel/level-check";
import type { WeekLevelCheck } from "@/server/scheduling/week";
import { ACCENT } from "./colors";

export type CalendarItem =
  | { kind: "session"; id: string; startsAt: Date; endsAt: Date; session: DaySession }
  | { kind: "levelCheck"; id: string; startsAt: Date; endsAt: Date; slot: WeekLevelCheck };

export type WeekData = {
  /** Saturday, "YYYY-MM-DD" (Tehran). */
  start: string;
  today: string;
  now: Date;
  sessions: DaySession[];
  levelChecks: WeekLevelCheck[];
  limits: { day: number; week: number };
  leads: WaitingLead[];
};

/** What counts toward Mona's hours: sessions that aren't cancelled and booked level checks. */
export function isBusy(item: CalendarItem): boolean {
  return item.kind === "session" ? item.session.phase !== "cancelled" : !!item.slot.lead;
}

/** The title, the line under it and the status pill for one calendar entry. */
export function useItemText(item: CalendarItem, data: WeekData) {
  const t = useTranslations("Admin.schedule");
  const locale = useLocale() as Locale;
  const time = t("timeRange", {
    from: formatTime(item.startsAt, locale),
    to: formatTime(item.endsAt, locale),
  });
  const today = tehranDateKey(item.startsAt) === data.today && item.startsAt > data.now;
  if (item.kind === "levelCheck") {
    const lead = item.slot.lead;
    return {
      time,
      title: lead ? lead.name : t("legend.open"),
      fullTitle: lead ? t("levelCheckTitle", { name: lead.name }) : t("openTitle"),
      meta: lead ? t(lead.source) : null,
      pill: lead && today ? ("today" as const) : null,
      color: lead ? ACCENT.levelCheck : null,
    };
  }
  const s = item.session;
  const name = classTitle(s, locale);
  const title = s.kind === "makeup" ? t("makeupTitle", { name }) : name;
  const pill = s.phase === "upcoming" ? (today ? ("today" as const) : null) : s.phase;
  return {
    time,
    title,
    fullTitle: title,
    meta: s.movedFrom && s.phase !== "cancelled" ? t("moved") : null,
    pill,
    color:
      s.phase === "cancelled"
        ? ACCENT.cancelled
        : s.kind === "makeup"
          ? ACCENT.makeup
          : ACCENT[s.type],
  };
}

export const PILL_STYLE = {
  held: "bg-[#ddf5e8] text-[#14613a]",
  ended: "bg-[#fcefd3] text-[#8a520e]",
  live: "bg-ocean text-white",
  cancelled: "bg-[#fdecea] text-[#b03a2e]",
  today: "bg-mist text-brand",
  upcoming: "bg-mist text-brand",
} as const;
