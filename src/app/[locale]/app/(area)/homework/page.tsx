import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { HomeworkList } from "@/components/student/homework-list";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";
import { requireStudent } from "@/server/auth/current";
import { learnerHomework } from "@/server/homework/submissions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Student.homework");
  return { title: t("title") };
}

export default function LearnerHomeworkPage({ searchParams }: PageProps<"/[locale]/app/homework">) {
  return (
    <Suspense
      fallback={<div aria-hidden="true" className="h-64 animate-pulse rounded-card bg-mist" />}
    >
      <Homework searchParams={searchParams} />
    </Suspense>
  );
}

const TABS = ["todo", "submitted", "reviewed"] as const;
const tabOf = (h: { status: string | null }) =>
  h.status === null || h.status === "needs_revision"
    ? "todo"
    : h.status === "submitted"
      ? "submitted"
      : "reviewed";

async function Homework({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireStudent();
  const { tab: param } = await searchParams;
  const tab = TABS.find((x) => x === param) ?? "todo";
  const now = new Date();
  const [t, locale, all] = await Promise.all([
    getTranslations("Student.homework"),
    getLocale() as Promise<Locale>,
    learnerHomework(user.id),
  ]);
  const by = (x: (typeof TABS)[number]) => all.filter((h) => tabOf(h) === x);
  // Most urgent first: soonest deadline, then the ones with none.
  const todo = by("todo").sort(
    (a, b) => (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity),
  );
  const items = tab === "todo" ? todo : by(tab);

  return (
    <div className="space-y-5">
      <h1 className="text-4xl sm:text-5xl">{t("title")}</h1>
      <nav aria-label={t("title")} className="flex flex-wrap gap-2">
        {TABS.map((x) => (
          <Link
            key={x}
            href={x === "todo" ? "/app/homework" : `/app/homework?tab=${x}`}
            aria-current={x === tab ? "page" : undefined}
            className={`inline-flex min-h-touch items-center gap-2 rounded-pill border px-4 font-bold ${
              x === tab
                ? "border-ocean bg-ocean text-white"
                : "border-line/50 bg-white text-body hover:border-brand"
            }`}
          >
            {t(`tabs.${x}`)}
            <span className="font-semibold opacity-75">{formatNumber(by(x).length, locale)}</span>
          </Link>
        ))}
      </nav>
      <HomeworkList
        items={items}
        now={now}
        locale={locale}
        empty={
          all.length === 0
            ? t("emptyAll")
            : t(`empty${tab === "todo" ? "Todo" : tab === "submitted" ? "Submitted" : "Reviewed"}`)
        }
      />
      {tab === "todo" && by("reviewed").length > 0 && (
        <section aria-labelledby="recent" className="space-y-3">
          <h2 id="recent" className="font-sans text-lg font-extrabold normal-case tracking-normal">
            {t("recent")}
          </h2>
          <HomeworkList items={by("reviewed").slice(0, 3)} now={now} locale={locale} empty="" />
        </section>
      )}
    </div>
  );
}
