import { CaretLeft } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AssignButton } from "@/components/admin/homework/assign-button";
import { TYPE_LOOK } from "@/components/homework/homework-types";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatNumber } from "@/lib/format";
import { learnerNames } from "@/lib/names";
import { classTitle } from "@/lib/names";
import { requireTeacher } from "@/server/auth/current";
import { homeworkBoard, type BoardLearner } from "@/server/homework/board";

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

const FILTERS = ["submitted", "needs_revision", "reviewed", "all"] as const;
type Filter = (typeof FILTERS)[number];

const shows = (filter: Filter, l: BoardLearner) => filter === "all" || l.status === filter;

const tagTone = {
  submitted: "bg-cinnamon-soft text-cinnamon-ink",
  needs_revision: "bg-[#fdf3dc] text-[#6b4e00]",
  reviewed: "bg-[#ddf5e8] text-[#14613a]",
} as const;

/**
 * Homework review: status chips on top, then one card per homework item, grouped by the session
 * it was given for. Each learner row opens that answer's review; learners who haven't sent are
 * listed under "All" without a link.
 */
async function Homework({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { teacherId } = await requireTeacher();
  const { filter: param } = await searchParams;
  const filter = FILTERS.find((f) => f === param) ?? "submitted";
  const [t, tb, ta, locale, board] = await Promise.all([
    getTranslations("Admin.homework"),
    getTranslations("Admin.homework.board"),
    getTranslations("Admin.homework.assignDialog"),
    getLocale() as Promise<Locale>,
    homeworkBoard(teacherId),
  ]);
  const n = (v: number) => formatNumber(v, locale);
  const everyone = board.flatMap((g) => g.homework.flatMap((h) => h.learners));
  const count = (f: Filter) => everyone.filter((l) => shows(f, l)).length;
  const waitingSessions = board.filter((g) =>
    g.homework.some((h) => h.learners.some((l) => l.status === "submitted")),
  ).length;
  const groups = board
    .map((g) => ({
      ...g,
      homework: g.homework
        .map((h) => ({ ...h, shown: h.learners.filter((l) => shows(filter, l)) }))
        .filter((h) => h.shown.length > 0),
    }))
    .filter((g) => g.homework.length > 0);

  return (
    <div className="max-w-3xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl sm:text-5xl">{t("title")}</h1>
          <p className="mt-1">
            {tb("subtitle", { waiting: count("submitted"), sessions: waitingSessions })}
          </p>
        </div>
        <AssignButton />
      </header>

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
            {f === "all" ? tb("all") : t(`filter.${f}`)}
            <span
              className={`grid min-w-6 place-items-center rounded-pill px-1.5 text-sm ${f === filter ? "bg-brand-light text-ocean" : "bg-mist text-brand"}`}
            >
              {n(count(f))}
            </span>
          </Link>
        ))}
      </nav>

      {groups.length === 0 ? (
        <p className="rounded-card border border-hairline bg-white p-6">
          {board.length === 0 ? tb("emptyAll") : t(`empty.${filter as "submitted"}`)}
        </p>
      ) : (
        groups.map((g) => (
          <section key={g.sessionId} aria-labelledby={`s-${g.sessionId}`} className="space-y-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2
                id={`s-${g.sessionId}`}
                className="font-sans text-base font-extrabold normal-case tracking-normal"
              >
                <Link href={`/admin/sessions/${g.sessionId}`} className="hover:underline">
                  {g.number
                    ? tb("group", {
                        class: classTitle({ nameFa: g.classNameFa, nameEn: g.classNameEn }, locale),
                        n: g.number,
                      })
                    : tb("groupMakeup", {
                        class: classTitle({ nameFa: g.classNameFa, nameEn: g.classNameEn }, locale),
                      })}
                </Link>
              </h2>
              <p className="text-sm">
                {tb("groupSub", {
                  date: formatDate(g.startsAt, locale, { year: false }),
                  count: g.homework.length,
                })}
              </p>
            </div>
            <ul className="space-y-3">
              {g.homework.map((h) => {
                const look = TYPE_LOOK[h.type];
                const Icon = look.icon;
                const sent = h.learners.filter((l) => l.status).length;
                return (
                  <li
                    key={h.id}
                    className="overflow-hidden rounded-card border border-hairline bg-white"
                  >
                    <div className="flex items-center gap-3 p-4">
                      <span
                        className={`grid size-10 shrink-0 place-items-center rounded-xl ${look.tone}`}
                      >
                        <Icon aria-hidden size={20} />
                      </span>
                      <div className="min-w-0 flex-1 leading-snug">
                        <h3
                          dir="auto"
                          className="font-sans text-base font-extrabold normal-case tracking-normal text-ocean"
                        >
                          {h.title}
                        </h3>
                        <p className="text-sm">
                          {tb("cardMeta", {
                            type: ta(`types.${h.type}`),
                            sent,
                            total: h.learners.length,
                            waiting: h.learners.filter((l) => l.status === "submitted").length,
                          })}
                        </p>
                      </div>
                    </div>
                    <ul className="divide-y divide-mist border-t border-mist">
                      {h.shown.map((l) => {
                        const name = learnerNames(l, locale).primary;
                        const tag = l.status && [
                          tb(`tag.${l.status}`),
                          ...(l.late ? [tb("late")] : []),
                          ...(l.revision > 1 ? [tb("secondTry", { n: l.revision })] : []),
                        ];
                        const body = (
                          <>
                            <span
                              aria-hidden="true"
                              className="grid size-9 shrink-0 place-items-center rounded-full bg-mist font-extrabold text-brand"
                            >
                              {name.slice(0, 1)}
                            </span>
                            <span className="min-w-0 flex-1 leading-snug">
                              <b className="block text-ocean">{name}</b>
                              <span className="text-sm">
                                {l.submittedAt
                                  ? tb("sentOn", {
                                      date: formatDate(l.submittedAt, locale, { year: false }),
                                    })
                                  : tb("notSent")}
                              </span>
                            </span>
                            {l.status && tag && (
                              <span
                                className={`rounded-pill px-2.5 py-0.5 text-xs font-bold ${tagTone[l.status]}`}
                              >
                                {tag.join(locale === "fa" ? "، " : ", ")}
                              </span>
                            )}
                          </>
                        );
                        return (
                          <li key={l.studentId}>
                            {l.submissionId ? (
                              <Link
                                href={`/admin/homework/${l.submissionId}`}
                                aria-label={tb("openLabel", { name, title: h.title })}
                                className="flex items-center gap-3 px-4 py-3 hover:bg-surface"
                              >
                                {body}
                                <span className="inline-flex items-center gap-1 text-sm font-bold text-brand">
                                  {tb("open")}
                                  <CaretLeft
                                    aria-hidden
                                    size={14}
                                    className="icon-directional-rev"
                                  />
                                </span>
                              </Link>
                            ) : (
                              <div className="flex items-center gap-3 px-4 py-3 opacity-70">
                                {body}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
