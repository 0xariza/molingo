import { CalendarCheck, CalendarPlus, Phone, UserPlus } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { StatCard } from "@/components/area/stat-card";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatNumber, formatTime, tehranDateKey } from "@/lib/format";
import { requireAdmin } from "@/server/auth/current";
import { listUpcomingSlots } from "@/server/funnel/level-check";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin");
  return { title: t("title") };
}

export default function AdminHome() {
  return (
    <Suspense
      fallback={<div aria-hidden="true" className="h-64 animate-pulse rounded-card bg-mist" />}
    >
      <Dashboard />
    </Suspense>
  );
}

/** Reads the session and today's data, so it streams in per request. */
async function Dashboard() {
  await requireAdmin();
  const [t, levels, locale] = await Promise.all([
    getTranslations("Admin.home"),
    getTranslations("Landing.booking.levels"),
    getLocale() as Promise<Locale>,
  ]);
  const now = new Date();
  const slots = await listUpcomingSlots(now);
  const booked = slots.flatMap(({ lead, ...slot }) => (lead ? [{ ...slot, lead }] : []));
  const today = booked.filter((s) => tehranDateKey(s.startsAt) === tehranDateKey(now));
  const n = (value: number) => formatNumber(value, locale);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-brand">{formatDate(now, locale, { year: false })}</p>
        <h1 className="font-sans text-xl font-extrabold normal-case tracking-normal sm:text-2xl">
          {today.length
            ? t("summary", { count: today.length, time: formatTime(today[0].startsAt, locale) })
            : t("summaryNone")}
        </h1>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={CalendarCheck} tone="blue" label={t("statToday")} value={n(today.length)} />
        <StatCard icon={UserPlus} tone="sand" label={t("statBooked")} value={n(booked.length)} />
        <StatCard
          icon={CalendarPlus}
          tone="green"
          label={t("statOpen")}
          value={n(slots.length - booked.length)}
        />
      </section>

      <section
        aria-labelledby="booked-title"
        className="rounded-[1.75rem] border border-line/40 bg-white p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2
            id="booked-title"
            className="font-sans text-lg font-extrabold normal-case tracking-normal"
          >
            {t("bookedTitle")}
          </h2>
          <Link href="/admin/level-checks" className="text-sm font-bold text-brand underline">
            {t("manage")}
          </Link>
        </div>
        {booked.length === 0 ? (
          <p className="mt-4">{t("bookedEmpty")}</p>
        ) : (
          <ul className="mt-4 divide-y divide-mist">
            {booked.slice(0, 6).map(({ id, startsAt, lead }) => (
              <li key={id} className="flex items-center gap-3 py-3">
                <span
                  aria-hidden="true"
                  className="grid size-11 shrink-0 place-items-center rounded-full bg-mist font-extrabold text-brand"
                >
                  {lead.name.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1 leading-snug">
                  <p className="truncate font-bold text-ocean">{lead.name}</p>
                  <p className="text-sm">
                    {formatDate(startsAt, locale, { year: false })} · {formatTime(startsAt, locale)}{" "}
                    · {levels(lead.levelGuess)}
                  </p>
                </div>
                <a
                  href={`tel:${lead.phone}`}
                  aria-label={t("call", { name: lead.name })}
                  className="grid size-11 shrink-0 place-items-center rounded-full bg-ocean text-white hover:bg-deep"
                >
                  <Phone aria-hidden size={18} />
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
