"use client";

import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import type { Locale } from "@/i18n/routing";
import { TEHRAN } from "@/lib/format";

const noopSubscribe = () => () => {};

function clock(date: Date, timeZone: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "fa" ? "fa-IR-u-nu-arabext" : "en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

/**
 * The same session in the device's own time, shown only when it differs from Tehran time
 * (learners abroad). Rendered after hydration: the server can't know the device's zone.
 */
export function DeviceTime({ from, to, locale }: { from: Date; to: Date; locale: Locale }) {
  const t = useTranslations("Student.schedule");
  const zone = useSyncExternalStore(
    noopSubscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => TEHRAN,
  );
  if (clock(from, zone, locale) === clock(from, TEHRAN, locale)) return null;
  return (
    <p className="text-sm text-whale">
      {t("deviceTime", { from: clock(from, zone, locale), to: clock(to, zone, locale) })}
    </p>
  );
}
