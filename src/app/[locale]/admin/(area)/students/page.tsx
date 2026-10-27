import { Plus } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { FollowUps } from "@/components/admin/learners/follow-ups";
import { LearnerList } from "@/components/admin/learners/learner-list";
import { LearnerStats } from "@/components/admin/learners/learner-stats";
import { buttonClass } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requireTeacher } from "@/server/auth/current";
import {
  countByStatus,
  learnerStatuses,
  listFollowUps,
  listLearners,
  type LearnerStatus,
} from "@/server/students/learners";
import { learnerStats } from "@/server/students/stats";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.learners");
  return { title: t("title") };
}

export default function LearnersPage({ searchParams }: PageProps<"/[locale]/admin/students">) {
  return (
    <Suspense
      fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-card bg-mist" />}
    >
      <Learners searchParams={searchParams} />
    </Suspense>
  );
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function Learners({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { teacherId } = await requireTeacher();
  const params = await searchParams;
  const statusParam = one(params.status);
  const status = learnerStatuses.includes(statusParam as LearnerStatus)
    ? (statusParam as LearnerStatus)
    : undefined;
  const q = one(params.q)?.trim().slice(0, 80) || undefined;

  const [t, locale, stats, followUps, rows, counts] = await Promise.all([
    getTranslations("Admin.learners"),
    getLocale() as Promise<Locale>,
    learnerStats(teacherId),
    listFollowUps(teacherId),
    listLearners(teacherId, { status, q }),
    countByStatus(teacherId),
  ]);
  const total = learnerStatuses.reduce((sum, s) => sum + counts[s], 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl sm:text-5xl">{t("title")}</h1>
          <p className="mt-1">{t("total", { count: total })}</p>
        </div>
        <Link href="/admin/students/new" className={buttonClass("primary")}>
          <Plus aria-hidden size={18} weight="bold" />
          {t("add")}
        </Link>
      </header>
      {total > 0 && <LearnerStats stats={stats} locale={locale} />}
      <FollowUps items={followUps} />
      <LearnerList rows={rows} counts={counts} status={status} q={q} />
    </div>
  );
}
