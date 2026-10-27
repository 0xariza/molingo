import {
  ChalkboardTeacher,
  Chair,
  UsersThree,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import { getTranslations } from "next-intl/server";
import { StatCard } from "@/components/area/stat-card";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";
import { classTitle, learnerNames } from "@/lib/names";
import { cefrLevels, type ClassCard } from "@/server/classes/classes";
import type { ClassStats as Stats } from "@/server/classes/stats";

const card = "rounded-card border border-hairline bg-white p-6";
const heading = "font-sans text-lg font-extrabold normal-case tracking-normal";

/** Stat tiles and the two charts at the top of the classes page. */
export async function ClassStats({
  stats,
  cards,
  locale,
}: {
  stats: Stats;
  cards: ClassCard[];
  locale: Locale;
}) {
  const t = await getTranslations("Admin.classes");
  const n = (v: number) => formatNumber(v, locale);
  const sep = locale === "fa" ? "، " : ", ";
  const running = cards.filter((c) => c.state === "open" || c.state === "full");
  const maxLevel = Math.max(1, ...cefrLevels.map((l) => stats.byLevel[l]));
  const firstIdle = stats.withoutClass[0];

  return (
    <>
      <section aria-label={t("stats.label")} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={ChalkboardTeacher}
          tone="blue"
          label={t("stats.running")}
          value={n(stats.running.total)}
          detail={t("stats.runningDetail", {
            group: n(stats.running.group),
            private: n(stats.running.private),
          })}
        />
        <StatCard
          icon={Chair}
          tone="green"
          label={t("stats.seats")}
          value={t("stats.seatsValue", {
            taken: n(stats.seats.taken),
            total: n(stats.seats.total),
          })}
          detail={t("stats.seatsDetail", { count: stats.seats.total - stats.seats.taken })}
        />
        <StatCard
          icon={UsersThree}
          tone="sand"
          label={t("stats.full")}
          value={n(stats.full)}
          detail={t("stats.fullDetail")}
        />
        <StatCard
          icon={WarningCircle}
          tone="sand"
          label={t("stats.withoutClass")}
          value={n(stats.withoutClass.length)}
          detail={firstIdle ? learnerNames(firstIdle, locale).primary : t("stats.withoutClassNone")}
        />
      </section>

      {running.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section aria-labelledby="fill-title" className={`${card} space-y-4`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="fill-title" className={heading}>
                {t("stats.fillTitle")}
              </h2>
              <span className="text-sm">{t("stats.fillSub")}</span>
            </div>
            <ul
              aria-label={t("stats.fillSummary", {
                list: running
                  .map((c) => `${classTitle(c, locale)} ${n(c.taken)}/${n(c.capacity)}`)
                  .join(sep),
              })}
              className="space-y-3"
            >
              {running.map((c) => (
                <li
                  key={c.id}
                  className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3"
                >
                  <Link
                    href={`/admin/classes/${c.id}`}
                    className="truncate text-sm font-semibold text-ocean hover:underline"
                  >
                    {classTitle(c, locale)}
                  </Link>
                  <div aria-hidden="true" className="h-3.5 rounded bg-mist">
                    <div
                      className="h-full rounded bg-brand"
                      style={{ width: `${(c.taken / c.capacity) * 100}%` }}
                    />
                  </div>
                  <strong dir="ltr" className="text-sm text-ocean">
                    {n(c.taken)}/{n(c.capacity)}
                  </strong>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="level-title" className={card}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="level-title" className={heading}>
                {t("stats.levelTitle")}
              </h2>
              <span className="text-sm">{t("stats.levelSub")}</span>
            </div>
            <div
              role="img"
              aria-label={t("stats.levelSummary", {
                list: cefrLevels.map((l) => `${l} ${n(stats.byLevel[l])}`).join(sep),
              })}
              className="mt-5"
            >
              <div
                dir="ltr"
                className="flex h-40 items-end gap-3 border-b border-line/50 bg-[linear-gradient(var(--color-mist)_1px,transparent_1px)] bg-size-[100%_25%]"
              >
                {cefrLevels.map((l) => (
                  <div
                    key={l}
                    className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                  >
                    <span className="text-sm font-bold text-ocean">{n(stats.byLevel[l])}</span>
                    <div
                      className="w-full max-w-11 rounded-t bg-brand"
                      style={{ height: `${(stats.byLevel[l] / maxLevel) * 80}%` }}
                    />
                  </div>
                ))}
              </div>
              <div dir="ltr" className="mt-2 flex gap-3 text-center text-sm font-bold">
                {cefrLevels.map((l) => (
                  <span key={l} className="flex-1">
                    {l}
                  </span>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
