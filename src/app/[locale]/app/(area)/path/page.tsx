import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PathMap } from "@/components/student/path-map";
import { buttonClass } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";
import { classTitle } from "@/lib/names";
import { learnerAssessments } from "@/server/assessments/assessments";
import { requireStudent } from "@/server/auth/current";
import { learnerPaths } from "@/server/paths/station-check";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Student.path");
  return { title: t("title") };
}

export default function LearnerPathPage() {
  return (
    <Suspense
      fallback={<div aria-hidden="true" className="h-64 animate-pulse rounded-card bg-mist" />}
    >
      <Path />
    </Suspense>
  );
}

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

/** A ring showing `done` of `total`, with the count inside. */
function Ring({ done, total, label }: { done: number; total: number; label: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div role="img" aria-label={label} className="relative size-24 shrink-0 sm:size-32">
      <svg viewBox="0 0 120 120" aria-hidden className="size-full -rotate-90">
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeOpacity=".18"
          strokeWidth="10"
        />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="#f29a62"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - (total ? done / total : 0))}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-center leading-tight">
        <span>
          <b className="block text-3xl font-extrabold">{done}</b>
          <span className="text-xs opacity-80">/ {total}</span>
        </span>
      </span>
    </div>
  );
}

async function Path() {
  const user = await requireStudent();
  const [t, ta, tc, locale, paths, exams] = await Promise.all([
    getTranslations("Student.path"),
    getTranslations("Student.assessment"),
    getTranslations("Admin.classes"),
    getLocale() as Promise<Locale>,
    learnerPaths(user.id),
    learnerAssessments(user.id),
  ]);
  const n = (v: number) => formatNumber(v, locale);
  const open = exams.filter((e) => !e.publishedAt);
  const results = exams.filter((e) => e.publishedAt);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-4xl sm:text-5xl">{t("title")}</h1>
        <Link href="/app/path/progress" className={buttonClass("ghost", "min-h-11 px-5 text-sm")}>
          {t("progress")}
        </Link>
      </div>
      {paths.length === 0 && <p>{t("empty")}</p>}

      {paths.map((p) => {
        const target = LEVELS[LEVELS.indexOf(p.level) + 1] ?? null;
        const total = p.stations.length;
        const done = p.stations.filter((s) => s.state === "done").length;
        const at = p.stations.findIndex((s) => s.state === "current");
        const now = at >= 0 ? p.stations[at] : null;
        const skills = p.stations.flatMap((s) => s.skills);
        const ready = skills.filter((k) => k.result === "ready").length;
        const worked = now?.skills.filter((k) => k.worked).length ?? 0;
        return (
          <section key={p.classId} className="space-y-6">
            <div className="relative overflow-hidden rounded-[28px] bg-ocean p-6 text-white sm:p-8">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-4">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
                    <span dir="auto" className="rounded-pill bg-white/15 px-3 py-1">
                      {classTitle(p, locale)}
                    </span>
                    <span className="rounded-pill bg-white/15 px-3 py-1">
                      <bdi dir="ltr">
                        {p.level}
                        {target && ` → ${target}`}
                      </bdi>
                      {" · "}
                      {tc(`levels.${p.level as "A1"}`)}
                    </span>
                  </p>
                  {now ? (
                    <>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-[#f9c9a6]">
                          {t("stationOf", { n: n(at + 1), total: n(total) })}
                          {" · "}
                          {t("sessionOf", {
                            n: n(Math.min(now.held + 1, now.planned)),
                            total: n(now.planned),
                          })}
                        </p>
                        <h2
                          dir="auto"
                          className="font-sans text-2xl font-extrabold normal-case leading-snug tracking-normal text-white sm:text-3xl"
                        >
                          {now.title}
                        </h2>
                      </div>
                      <div className="flex items-center gap-3">
                        <div
                          className="grid max-w-xs flex-1 gap-1.5"
                          style={{
                            gridTemplateColumns: `repeat(${Math.max(now.skills.length, 1)}, minmax(0, 1fr))`,
                          }}
                        >
                          {now.skills.map((k) => (
                            <span
                              key={k.id}
                              className={`h-2 rounded-full ${k.worked ? "bg-[#f29a62]" : "bg-white/20"}`}
                            />
                          ))}
                        </div>
                        <span className="text-sm font-bold">
                          {t("workedOn", { n: n(worked), total: n(now.skills.length) })}
                        </span>
                      </div>
                    </>
                  ) : (
                    <h2 className="font-sans text-2xl font-extrabold normal-case tracking-normal text-white">
                      {t("allDone")}
                    </h2>
                  )}
                  <div className="flex flex-wrap gap-3">
                    <Link href="/app/homework" className={buttonClass("sand", "w-full sm:w-auto")}>
                      {t("myHomework")}
                    </Link>
                    <Link
                      href="/app/classes"
                      className={buttonClass("ghostLight", "w-full sm:w-auto")}
                    >
                      {t("lastSession")}
                    </Link>
                  </div>
                </div>
                <div className="flex items-center gap-4 sm:flex-col sm:text-center">
                  <Ring
                    done={done}
                    total={total}
                    label={t("stationsDone", { done: n(done), total: n(total) })}
                  />
                  <p className="text-sm font-bold">
                    {t("stationsDone", { done: n(done), total: n(total) })}
                  </p>
                </div>
              </div>
            </div>

            <PathMap stations={p.stations}>
              {open.map((e) => (
                <Link
                  key={e.id}
                  href={`/app/assessment/${e.id}`}
                  className="block space-y-1 rounded-card border border-cinnamon bg-cinnamon-soft p-4"
                >
                  <b className="block text-ocean">
                    {ta(e.kind === "stage" ? "kindStage" : "kindFinal")}
                  </b>
                  <span className="text-sm font-bold text-cinnamon-ink">
                    {e.submittedAt
                      ? ta("handedIn")
                      : `${ta("start")} · ${ta("minutes", { n: e.minutes })}`}
                  </span>
                </Link>
              ))}
              <div className="space-y-3 rounded-card border border-hairline bg-white p-4">
                <b className="block text-ocean">{t("overall")}</b>
                <p className="text-sm">
                  {t("skillsReady", { n: n(ready), total: n(skills.length) })}
                </p>
                <div className="h-2 overflow-hidden rounded-full bg-surface">
                  <div
                    className="h-full rounded-full bg-[#1f7a4d]"
                    style={{
                      width: `${skills.length ? Math.round((ready / skills.length) * 100) : 0}%`,
                    }}
                  />
                </div>
                {target && (
                  <p className="rounded-xl bg-surface px-3 py-2 text-sm">
                    {t("goal")}{" "}
                    <bdi dir="ltr" className="font-extrabold text-ocean">
                      {target}
                    </bdi>{" "}
                    · {t("goalNote")}
                  </p>
                )}
              </div>
              {results.length > 0 && (
                <div className="space-y-2 rounded-card border border-hairline bg-white p-4">
                  <b className="block text-ocean">{ta("onPath")}</b>
                  {results.map((e) => (
                    <Link
                      key={e.id}
                      href={`/app/assessment/${e.id}`}
                      className="flex min-h-11 items-center justify-between rounded-xl bg-surface px-3 text-sm font-bold text-ocean"
                    >
                      <span>{ta(e.kind === "stage" ? "kindStage" : "kindFinal")}</span>
                      <span className="text-[#14613a]">{ta("resultReady")}</span>
                    </Link>
                  ))}
                </div>
              )}
            </PathMap>
          </section>
        );
      })}
    </div>
  );
}
