import { Plus } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ClassList, classFilters, type ClassFilter } from "@/components/admin/classes/class-list";
import { ClassStats } from "@/components/admin/classes/class-stats";
import { buttonClass } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requireAdmin } from "@/server/auth/current";
import { listCandidates, listClasses } from "@/server/classes/classes";
import { classStats } from "@/server/classes/stats";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.classes");
  return { title: t("title") };
}

export default function ClassesPage({ searchParams }: PageProps<"/[locale]/admin/classes">) {
  return (
    <Suspense
      fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-card bg-mist" />}
    >
      <Classes searchParams={searchParams} />
    </Suspense>
  );
}

async function Classes({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const { show } = await searchParams;
  const filter = classFilters.includes(show as ClassFilter) ? (show as ClassFilter) : "running";
  const [t, locale, cards, candidates] = await Promise.all([
    getTranslations("Admin.classes"),
    getLocale() as Promise<Locale>,
    listClasses(),
    listCandidates(),
  ]);
  const stats = await classStats(cards);
  const running = cards.filter((c) => c.state === "open" || c.state === "full").length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl sm:text-5xl">{t("title")}</h1>
          <p className="mt-1">{t("total", { count: running })}</p>
        </div>
        <Link href="/admin/classes/new" className={buttonClass("primary")}>
          <Plus aria-hidden size={18} weight="bold" />
          {t("add")}
        </Link>
      </header>
      {cards.length > 0 && <ClassStats stats={stats} cards={cards} locale={locale} />}
      <ClassList cards={cards} filter={filter} candidates={candidates} />
    </div>
  );
}
