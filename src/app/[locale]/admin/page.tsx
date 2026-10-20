import { Chair, ClipboardText, Phone, Plus, UserPlus } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AwaitingConfirmation, NextClassCard, TodayTimeline } from "@/components/admin/dashboard";
import { StatCard } from "@/components/area/stat-card";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatNumber, formatTime, tehranDateKey } from "@/lib/format";
import { requireAdmin } from "@/server/auth/current";
import { listClasses, teacherIdFor } from "@/server/classes/classes";
import { awaitingConfirmation, nextClassSession, sessionsToday } from "@/server/classes/sessions";
import { listFollowUps } from "@/server/students/learners";
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
  const admin = await requireAdmin();
  const [t, levels, locale] = await Promise.all([
    getTranslations("Admin.home"),
    getTranslations("Landing.booking.levels"),
    getLocale() as Promise<Locale>,
  ]);
  const now = new Date();
  const teacherId = await teacherIdFor(admin.id);
  const [slots, classesToday, pending, next, leads, cards] = await Promise.all([
    listUpcomingSlots(now),
    sessionsToday(teacherId, now),
    awaitingConfirmation(teacherId, now),
    nextClassSession(teacherId, now),
    listFollowUps(),
    listClasses(),
  ]);
  const emptySeats = cards
    .filter((c) => c.type === "group" && (c.state === "open" || c.state === "full"))
    .reduce((sum, c) => sum + c.capacity - c.taken, 0);
  const booked = slots.flatMap(({ lead, ...slot }) => (lead ? [{ ...slot, lead }] : []));
  const today = booked.filter((s) => tehranDateKey(s.startsAt) === tehranDateKey(now));
  const n = (value: number) => formatNumber(value, locale);
  const running = classesToday.filter((s) => s.phase !== "cancelled");
  const firstStart = [...running.map((s) => s.startsAt), ...today.map((s) => s.startsAt)].sort(
    (a, b) => a.getTime() - b.getTime(),
  )[0];
  const parts = [
    running.length ? t("listClasses", { count: running.length }) : null,
    today.length ? t("listFree", { count: today.length }) : null,
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-brand">{formatDate(now, locale, { year: false })}</p>
        <h1 className="font-sans text-xl font-extrabold normal-case tracking-normal sm:text-2xl">
          {firstStart
            ? t("summaryToday", {
                list: parts.join(t("and")),
                time: formatTime(firstStart, locale),
              })
            : t("summaryNothing")}
        </h1>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={UserPlus} tone="blue" label={t("statLeads")} value={n(leads.length)} />
        <StatCard
          icon={ClipboardText}
          tone="sand"
          label={t("statPending")}
          value={n(pending.length)}
        />
        <StatCard icon={Chair} tone="green" label={t("statSeats")} value={n(emptySeats)} />
      </section>

      <NextClassCard next={next} now={now} />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(20rem,1fr))] items-start gap-5">
        <TodayTimeline sessions={classesToday} freeSessions={today} />
        <section
          aria-labelledby="booked-title"
          className="space-y-4 rounded-[1.75rem] border border-line/40 bg-white p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              id="booked-title"
              className="font-sans text-lg font-black normal-case tracking-normal"
            >
              {t("bookedTitle")}
            </h2>
            <Link href="/admin/schedule" className="text-sm font-bold text-brand">
              {t("manage")}
            </Link>
          </div>
          {booked.length === 0 ? (
            <p>{t("bookedEmpty")}</p>
          ) : (
            <ul className="space-y-3">
              {booked.slice(0, 6).map(({ id, startsAt, lead }) => {
                const isToday = tehranDateKey(startsAt) === tehranDateKey(now);
                return (
                  <li key={id} className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="grid size-10.5 shrink-0 place-items-center rounded-full bg-mist font-black text-brand"
                    >
                      {lead.name.slice(0, 1)}
                    </span>
                    <span className="min-w-0 flex-1 leading-normal">
                      <b className="block truncate text-ocean">{lead.name}</b>
                      <span className="text-sm">
                        {formatDate(startsAt, locale, { year: false })} ·{" "}
                        {formatTime(startsAt, locale)} · {levels(lead.levelGuess)}
                      </span>
                    </span>
                    <a
                      href={`tel:${lead.phone}`}
                      aria-label={t("call", { name: lead.name })}
                      className={`grid size-11 shrink-0 place-items-center rounded-full ${
                        isToday
                          ? "bg-ocean text-white hover:bg-deep"
                          : "bg-mist text-brand hover:bg-whale/40"
                      }`}
                    >
                      <Phone aria-hidden size={18} />
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
          <Link
            href="/admin/schedule"
            className="inline-flex min-h-11 items-center gap-2 rounded-pill bg-mist px-4.5 font-extrabold text-brand hover:bg-whale/40"
          >
            <Plus aria-hidden size={16} weight="bold" />
            {t("addFreeTime")}
          </Link>
        </section>
        <AwaitingConfirmation sessions={pending} />
      </div>
    </div>
  );
}
