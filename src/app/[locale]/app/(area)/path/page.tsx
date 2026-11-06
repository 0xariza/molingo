import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { requireStudent } from "@/server/auth/current";
import { Link } from "@/i18n/navigation";
import { learnerAssessments } from "@/server/assessments/assessments";
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

async function Path() {
  const user = await requireStudent();
  const [t, ta, paths, exams] = await Promise.all([
    getTranslations("Student.path"),
    getTranslations("Student.assessment"),
    learnerPaths(user.id),
    learnerAssessments(user.id),
  ]);

  return (
    <div className="space-y-5">
      <h1 className="text-4xl sm:text-5xl">{t("title")}</h1>
      <Link
        href="/app/path/progress"
        className="inline-flex min-h-touch items-center font-bold text-brand hover:underline"
      >
        {t("progress")}
      </Link>
      {exams.length > 0 && (
        <section aria-label={ta("onPath")} className="space-y-2">
          {exams.map((e) => (
            <Link
              key={e.id}
              href={`/app/assessment/${e.id}`}
              className="flex min-h-12 items-center justify-between rounded-card border border-brand bg-white px-5 font-bold text-ocean"
            >
              <span>{ta(e.kind === "stage" ? "kindStage" : "kindFinal")}</span>
              <span>
                {e.publishedAt ? ta("resultReady") : e.submittedAt ? ta("handedIn") : ta("start")}
              </span>
            </Link>
          ))}
        </section>
      )}
      {paths.length === 0 && <p>{t("empty")}</p>}
      {paths.map((p) => (
        <ol key={p.classId} className="space-y-3">
          {p.stations.map((s, i) => (
            <li
              key={i}
              aria-current={s.state === "current" ? "step" : undefined}
              className="space-y-2 rounded-card border border-hairline bg-white p-5 aria-[current=step]:border-brand"
            >
              <p className="text-sm font-bold text-cinnamon-ink">
                {t("station", { n: i + 1 })} · {t(s.state)}
              </p>
              <h2
                className="font-sans text-lg font-extrabold normal-case tracking-normal"
                dir="auto"
              >
                {s.title}
              </h2>
              <ul className="space-y-1">
                {s.skills.map((k) => (
                  <li key={k.id} className="flex justify-between gap-3">
                    <span dir="auto">{k.text}</span>
                    {k.result && <span className="font-bold text-ocean">{t(k.result)}</span>}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      ))}
    </div>
  );
}
