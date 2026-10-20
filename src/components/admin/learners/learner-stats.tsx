import { ChartBar, ClockCountdown, UserPlus, Users } from "@phosphor-icons/react/dist/ssr";
import { getTranslations } from "next-intl/server";
import { StatCard } from "@/components/area/stat-card";
import type { Locale } from "@/i18n/routing";
import { formatJalaliMonth, formatNumber } from "@/lib/format";
import { learnerStatuses } from "@/server/students/learners";
import type { LearnerStats as Stats } from "@/server/students/stats";

/** Status identity colours (validated for colour-blind separation; labels always shown too). */
const statusColor = {
  active: "#13609b",
  lead: "#4a9fd6",
  paused: "#d18a1f",
  left: "#8a5cc2",
} as const;

const card = "rounded-[1.75rem] border border-line/40 bg-white p-6";
const heading = "font-sans text-lg font-extrabold normal-case tracking-normal";

/** Stat tiles and the two charts at the top of the learners page. */
export async function LearnerStats({ stats, locale }: { stats: Stats; locale: Locale }) {
  const [t, ts] = await Promise.all([
    getTranslations("Admin.learners.stats"),
    getTranslations("Admin.learners.status"),
  ]);
  const n = (value: number) => formatNumber(value, locale);
  const sep = locale === "fa" ? "، " : ", ";
  const { byStatus, perMonth, bookings, pendingLogins } = stats;
  const sinceMonth = formatJalaliMonth(bookings.since, locale);
  const conversion = bookings.total
    ? `${n(Math.round((bookings.converted / bookings.total) * 100))}%`
    : "—";
  const maxMonth = Math.max(1, ...perMonth.map((m) => m.count));
  const totalLearners = learnerStatuses.reduce((sum, s) => sum + byStatus[s], 0);
  const months = perMonth.map((m) => ({ ...m, label: formatJalaliMonth(m.date, locale) }));

  return (
    <>
      <section aria-label={t("label")} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Users}
          tone="blue"
          label={t("active")}
          value={n(byStatus.active)}
          detail={t("activeDetail")}
        />
        <StatCard
          icon={UserPlus}
          tone="green"
          label={t("newThisMonth")}
          value={n(perMonth.at(-1)?.count ?? 0)}
          detail={months.at(-1)?.label}
        />
        <StatCard
          icon={ChartBar}
          tone="blue"
          label={t("conversion")}
          value={conversion}
          detail={
            bookings.total
              ? t("conversionDetail", {
                  converted: n(bookings.converted),
                  total: n(bookings.total),
                  month: sinceMonth,
                })
              : t("noBookings", { month: sinceMonth })
          }
        />
        <StatCard
          icon={ClockCountdown}
          tone="sand"
          label={t("pending")}
          value={n(pendingLogins)}
          detail={t("pendingDetail")}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="per-month" className={card}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="per-month" className={heading}>
              {t("perMonthTitle")}
            </h2>
            <span className="text-sm">{t("perMonthRange")}</span>
          </div>
          <div
            role="img"
            aria-label={t("perMonthSummary", {
              list: months.map((m) => `${m.label} ${n(m.count)}`).join(sep),
            })}
            className="mt-5"
          >
            <div className="flex h-44 items-end gap-3 border-b border-line/50 bg-[linear-gradient(var(--color-mist)_1px,transparent_1px)] bg-size-[100%_25%]">
              {months.map((m) => (
                <div
                  key={m.key}
                  title={`${m.label}: ${n(m.count)}`}
                  className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                >
                  <span className="text-sm font-bold text-ocean">{n(m.count)}</span>
                  <div
                    className="w-full max-w-11 rounded-t bg-brand"
                    style={{ height: `${(m.count / maxMonth) * 85}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-3 text-center text-xs">
              {months.map((m) => (
                <span key={m.key} className="flex-1 truncate">
                  {m.label}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="by-status" className={`${card} space-y-5`}>
          <h2 id="by-status" className={heading}>
            {t("byStatusTitle")}
          </h2>
          <div
            role="img"
            aria-label={t("byStatusSummary", {
              list: learnerStatuses.map((s) => `${ts(s)} ${n(byStatus[s])}`).join(sep),
            })}
            className="flex h-7 gap-0.5 overflow-hidden rounded-md bg-mist"
          >
            {totalLearners > 0 &&
              learnerStatuses
                .filter((s) => byStatus[s] > 0)
                .map((s) => (
                  <div
                    key={s}
                    title={`${ts(s)}: ${n(byStatus[s])}`}
                    style={{ flexGrow: byStatus[s], background: statusColor[s] }}
                  />
                ))}
          </div>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-2">
            {learnerStatuses.map((s) => (
              <li key={s} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="size-3 shrink-0 rounded-sm"
                  style={{ background: statusColor[s] }}
                />
                {ts(s)}
                <strong className="ms-auto text-ocean">{n(byStatus[s])}</strong>
              </li>
            ))}
          </ul>
          <div className="space-y-2 border-t border-mist pt-4">
            <Meter label={t("booked")} value={bookings.total} max={bookings.total} n={n} />
            <Meter label={t("converted")} value={bookings.converted} max={bookings.total} n={n} />
          </div>
        </section>
      </div>
    </>
  );
}

function Meter({
  label,
  value,
  max,
  n,
}: {
  label: string;
  value: number;
  max: number;
  n: (v: number) => string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <strong className="text-ocean">{n(value)}</strong>
      </div>
      <div aria-hidden="true" className="h-2.5 rounded bg-mist">
        <div
          className="h-full rounded bg-brand"
          style={{ width: `${max ? (value / max) * 100 : 0}%` }}
        />
      </div>
    </div>
  );
}
