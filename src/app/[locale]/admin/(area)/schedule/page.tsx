import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { WeekView } from "@/components/admin/schedule/week-view";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatDate, fromTehranTime, tehranDateKey } from "@/lib/format";
import { addDays, weekStartOf } from "@/lib/schedule";
import { requireTeacher } from "@/server/auth/current";

import { listWaitingLeads } from "@/server/funnel/level-check";
import { weekSchedule } from "@/server/scheduling/week";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.schedule");
  return { title: t("title") };
}

export default function SchedulePage({ searchParams }: PageProps<"/[locale]/admin/schedule">) {
  return (
    <Suspense
      fallback={<div aria-hidden="true" className="h-[32rem] animate-pulse rounded-card bg-mist" />}
    >
      <Schedule searchParams={searchParams} />
    </Suspense>
  );
}

/** `?w=` moves by whole weeks from this one (…, -1, 0, 1, …), up to two years either way. */
function weekOffset(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) ? Math.max(-104, Math.min(104, n)) : 0;
}

async function Schedule({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // The session check comes first: it marks the request dynamic before the clock is read.
  const admin = await requireTeacher();
  const offset = weekOffset((await searchParams).w);
  const now = new Date();
  const today = tehranDateKey(now);
  const start = weekStartOf(today, offset);
  const teacherId = admin.teacherId;
  const [t, locale, week, leads] = await Promise.all([
    getTranslations("Admin.schedule"),
    getLocale() as Promise<Locale>,
    weekSchedule(teacherId, start, now),
    listWaitingLeads(teacherId),
  ]);
  const day = (key: string, year: boolean) =>
    formatDate(fromTehranTime(key, "12:00"), locale, { weekday: false, year });
  const range = t("range", { from: day(start, false), to: day(addDays(start, 6), true) });
  const title =
    offset === 0
      ? t("thisWeek")
      : offset === -1
        ? t("prevWeek")
        : offset === 1
          ? t("nextWeek")
          : range;
  const nav =
    "grid size-11 place-items-center rounded-full border border-line/50 bg-white text-ocean hover:border-brand";

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-brand">{t("title")}</p>
          <h1 className="text-4xl sm:text-5xl">{title}</h1>
          {title !== range && <p className="mt-1">{range}</p>}
        </div>
        <nav aria-label={t("weekNav")} className="flex items-center gap-2">
          <Link
            href={{ pathname: "/admin/schedule", query: { w: offset - 1 } }}
            aria-label={t("prevWeek")}
            className={nav}
          >
            <CaretLeft aria-hidden size={18} weight="bold" className="icon-directional" />
          </Link>
          <Link
            href="/admin/schedule"
            aria-current={offset === 0 ? "page" : undefined}
            className="inline-flex min-h-11 items-center rounded-pill border border-line/50 bg-white px-5 font-extrabold text-ocean hover:border-brand aria-[current=page]:border-ocean aria-[current=page]:bg-ocean aria-[current=page]:text-white"
          >
            {t("thisWeek")}
          </Link>
          <Link
            href={{ pathname: "/admin/schedule", query: { w: offset + 1 } }}
            aria-label={t("nextWeek")}
            className={nav}
          >
            <CaretRight aria-hidden size={18} weight="bold" className="icon-directional" />
          </Link>
        </nav>
      </header>
      <WeekView
        start={start}
        today={today}
        now={now}
        sessions={week.sessions}
        levelChecks={week.levelChecks}
        limits={week.limits}
        leads={leads}
      />
    </div>
  );
}
