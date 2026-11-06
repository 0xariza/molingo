import { Plus } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { buttonClass } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";
import { requireTeacher } from "@/server/auth/current";
import { listSources } from "@/server/paths/sources";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.sources");
  return { title: t("title") };
}

export default function SourcesPage() {
  return (
    <Suspense
      fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-card bg-mist" />}
    >
      <Sources />
    </Suspense>
  );
}

async function Sources() {
  const { teacherId } = await requireTeacher();
  const [t, locale, sources] = await Promise.all([
    getTranslations("Admin.sources"),
    getLocale() as Promise<Locale>,
    listSources(teacherId),
  ]);
  const n = (v: number) => formatNumber(v, locale);
  const badge = {
    complete: "bg-[#ddf5e8] text-[#14613a]",
    partial: "bg-mist text-brand",
    empty: "bg-cinnamon-soft text-cinnamon-ink",
  } as const;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl sm:text-5xl">{t("title")}</h1>
          <p className="mt-1">{t("lead")}</p>
        </div>
        <Link href="/admin/sources/new" className={buttonClass("primary")}>
          <Plus aria-hidden size={18} weight="bold" />
          {t("add")}
        </Link>
      </header>
      {sources.length === 0 ? (
        <p className="rounded-card border border-hairline bg-white p-6 text-center">{t("empty")}</p>
      ) : (
        <ul className="grid gap-3">
          {sources.map((s) => (
            <li key={s.id}>
              <Link
                href={`/admin/sources/${s.id}`}
                className="flex flex-wrap items-center gap-4 rounded-card border border-hairline bg-white p-5 hover:border-brand"
              >
                <bdi
                  dir="ltr"
                  className="grid size-12 shrink-0 place-items-center rounded-xl bg-ocean font-extrabold text-white"
                >
                  {s.level}
                </bdi>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-ocean">{s.title}</span>
                  <span className="text-sm">{t("stations", { count: n(s.total) })}</span>
                </span>
                <span className={`rounded-pill px-3 py-1 text-sm font-bold ${badge[s.state]}`}>
                  {s.state === "complete"
                    ? t("state.complete")
                    : t("state.partial", { done: n(s.done), total: n(s.total) })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
