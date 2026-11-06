import { ArrowDown, ArrowUp, Plus, Trash } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { BackLink } from "@/components/admin/learners/back-link";
import { StationEditor } from "@/components/admin/sources/station-editor";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";
import { requireTeacher } from "@/server/auth/current";
import { addStationAction, deleteStationAction, moveStationAction } from "@/server/paths/actions";
import { getSource, isStationComplete, mapState } from "@/server/paths/sources";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.sources");
  return { title: t("map.title") };
}

export default function SourceMapPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/sources/[id]">) {
  return (
    <div className="space-y-5">
      <Suspense
        fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-card bg-mist" />}
      >
        <SourceMap params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const tool =
  "grid size-11 place-items-center rounded-xl text-body hover:bg-surface disabled:text-line/40";

async function SourceMap({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { teacherId } = await requireTeacher();
  const [{ id }, { station: picked }] = await Promise.all([params, searchParams]);
  const valid = z.uuid().safeParse(id);
  const source = valid.success ? await getSource(teacherId, valid.data) : null;
  if (!source) notFound();
  const [t, locale] = await Promise.all([
    getTranslations("Admin.sources"),
    getLocale() as Promise<Locale>,
  ]);
  const n = (v: number) => formatNumber(v, locale);
  const index = Math.max(
    0,
    source.stations.findIndex((s) => s.id === picked),
  );
  const current = source.stations[index];
  const state = mapState(
    source.stations.map((s) => ({ title: s.title, skillCount: s.skills.length })),
  );
  const hidden = (stationId: string) => (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="sourceId" value={source.id} />
      <input type="hidden" name="stationId" value={stationId} />
    </>
  );

  return (
    <>
      <BackLink href="/admin/sources" label={t("title")} />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl sm:text-5xl">{source.title}</h1>
          <p className="mt-1">
            {t("map.subtitle", {
              level: `\u2068${source.level}\u2069`,
              count: n(source.stations.length),
            })}
          </p>
        </div>
        <div className="flex min-w-60 items-center gap-3">
          <span className="h-2 flex-1 overflow-hidden rounded-pill bg-mist">
            <span
              className="block h-full bg-brand"
              style={{ width: `${Math.round((state.done / state.total) * 100)}%` }}
            />
          </span>
          <b className="text-sm text-ocean">
            {t("map.done", { done: n(state.done), total: n(state.total) })}
          </b>
        </div>
      </header>

      <section
        aria-labelledby="what-t"
        className="grid gap-4 rounded-card bg-ocean p-6 text-mist sm:grid-cols-3"
      >
        <div>
          <h2 id="what-t" className="font-sans text-lg font-extrabold normal-case text-white">
            {t("map.whatTitle")}
          </h2>
          <p className="text-sm">{t("map.whatBody")}</p>
        </div>
        <ul className="space-y-1.5 text-sm">
          <li>{t("map.ruleSize")}</li>
          <li>{t("map.ruleSkills")}</li>
        </ul>
        <ul className="space-y-1.5 text-sm">
          <li>{t("map.ruleSessions")}</li>
          <li>{t("map.ruleEnd")}</li>
        </ul>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <nav
          aria-label={t("map.stations")}
          className="rounded-card border border-hairline bg-white p-2"
        >
          <ol className="space-y-0.5">
            {source.stations.map((s, i) => {
              const done = isStationComplete({ title: s.title, skillCount: s.skills.length });
              return (
                <li key={s.id}>
                  <Link
                    href={`/admin/sources/${source.id}?station=${s.id}`}
                    aria-current={i === index ? "page" : undefined}
                    className="flex min-h-14 items-center gap-3 rounded-xl px-3 py-2 hover:bg-surface aria-[current=page]:bg-mist"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-mist text-sm font-extrabold text-brand">
                      {n(i + 1)}
                    </span>
                    <span className="min-w-0 flex-1 leading-snug">
                      <span
                        className={`block truncate font-bold ${s.title ? "text-ocean" : "text-body/60"}`}
                      >
                        {s.title || t("map.untitled")}
                      </span>
                      <span className="text-xs">
                        {t("map.stationMeta", {
                          skills: n(s.skills.length),
                          sessions: n(s.plannedSessions),
                        })}
                      </span>
                    </span>
                    <span
                      className={`rounded-pill px-2 text-xs font-bold leading-6 ${done ? "bg-[#ddf5e8] text-[#14613a]" : "bg-cinnamon-soft text-cinnamon-ink"}`}
                    >
                      {done ? t("map.complete") : t("map.incomplete")}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
          <p className="mx-2 mt-2 border-t border-hairline pt-2 text-xs">{t("map.final")}</p>
        </nav>

        <section className="space-y-4 rounded-card border border-hairline bg-white p-6">
          <div className="flex flex-wrap justify-end gap-1">
            <form action={moveStationAction}>
              {hidden(current.id)}
              <input type="hidden" name="dir" value="up" />
              <button
                type="submit"
                disabled={index === 0}
                aria-label={t("map.moveUp")}
                className={tool}
              >
                <ArrowUp aria-hidden size={18} />
              </button>
            </form>
            <form action={moveStationAction}>
              {hidden(current.id)}
              <input type="hidden" name="dir" value="down" />
              <button
                type="submit"
                disabled={index === source.stations.length - 1}
                aria-label={t("map.moveDown")}
                className={tool}
              >
                <ArrowDown aria-hidden size={18} />
              </button>
            </form>
            <form action={addStationAction}>
              {hidden(current.id)}
              <button type="submit" aria-label={t("map.addAfter")} className={tool}>
                <Plus aria-hidden size={18} />
              </button>
            </form>
            <form action={deleteStationAction}>
              {hidden(current.id)}
              <input
                type="hidden"
                name="nextId"
                value={(source.stations[index + 1] ?? source.stations[index - 1] ?? current).id}
              />
              <button
                type="submit"
                disabled={source.stations.length <= 1}
                aria-label={t("map.delete")}
                className={`${tool} hover:text-red-700`}
              >
                <Trash aria-hidden size={18} />
              </button>
            </form>
          </div>
          <StationEditor key={current.id} station={current} number={index + 1} />
        </section>
      </div>
    </>
  );
}
