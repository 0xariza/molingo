import { CheckCircle, Clock, Tray } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AssignButton } from "@/components/admin/homework/assign-button";
import { OpenAssignments } from "@/components/admin/homework/open-assignments";
import { QueueList } from "@/components/admin/homework/queue-list";
import { StatCard } from "@/components/area/stat-card";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatNumber } from "@/lib/format";
import { requireTeacher } from "@/server/auth/current";
import { homeworkOverview } from "@/server/homework/assignments";
import { reviewQueue } from "@/server/homework/submissions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.homework");
  return { title: t("title") };
}

export default function HomeworkPage({ searchParams }: PageProps<"/[locale]/admin/homework">) {
  return (
    <Suspense
      fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-card bg-mist" />}
    >
      <Homework searchParams={searchParams} />
    </Suspense>
  );
}

const FILTERS = ["submitted", "needs_revision", "reviewed"] as const;

async function Homework({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { teacherId } = await requireTeacher();
  const { filter: param } = await searchParams;
  const filter = FILTERS.find((f) => f === param) ?? "submitted";
  const now = new Date();

  const [t, locale, stats, rows] = await Promise.all([
    getTranslations("Admin.homework"),
    getLocale() as Promise<Locale>,
    homeworkOverview(teacherId, now),
    reviewQueue(teacherId, filter),
  ]);
  const n = (v: number) => formatNumber(v, locale);
  const counts = {
    submitted: stats.toReview,
    needs_revision: stats.needsRevision,
    reviewed: stats.reviewed,
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl sm:text-5xl">{t("title")}</h1>
          <p className="mt-1">
            {t("subtitle", { review: stats.toReview, count: stats.assignedLast30 })}
          </p>
        </div>
        <AssignButton />
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          icon={Tray}
          tone="sand"
          label={t("stats.toReview")}
          value={n(stats.toReview)}
          detail={
            stats.oldestToReview
              ? t("stats.oldest", {
                  when: formatDate(stats.oldestToReview, locale, { year: false }),
                })
              : t("stats.oldestNone")
          }
        />
        <StatCard
          icon={Clock}
          tone="blue"
          label={t("stats.dueWeek")}
          value={n(stats.dueThisWeek)}
          detail={
            stats.dueThisWeek
              ? t("stats.dueWeekSub", { in: n(stats.dueThisWeekIn), of: n(stats.dueThisWeekOf) })
              : t("stats.dueWeekNone")
          }
        />
        <StatCard
          icon={CheckCircle}
          tone="green"
          label={t("stats.rate")}
          value={
            stats.handInRate === null
              ? "—"
              : new Intl.NumberFormat(locale, { style: "percent" }).format(stats.handInRate / 100)
          }
          detail={stats.handInRate === null ? t("stats.rateNone") : t("stats.rateSub")}
        />
      </div>

      <nav aria-label={t("filterLabel")} className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "submitted" ? "/admin/homework" : `/admin/homework?filter=${f}`}
            aria-current={f === filter ? "page" : undefined}
            className={`inline-flex min-h-touch items-center gap-2 rounded-pill border px-4 font-bold ${
              f === filter
                ? "border-ocean bg-ocean text-white"
                : "border-line/50 bg-white text-body hover:border-brand"
            }`}
          >
            {t(`filter.${f}`)}
            <span className="font-semibold opacity-75">{n(counts[f])}</span>
          </Link>
        ))}
      </nav>

      <QueueList rows={rows} empty={t(`empty.${filter}`)} />
      <OpenAssignments items={stats.open} />
    </div>
  );
}
