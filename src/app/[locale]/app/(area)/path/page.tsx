import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
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

async function Path() {
  const user = await requireStudent();
  const [t, paths] = await Promise.all([getTranslations("Student.path"), learnerPaths(user.id)]);

  return (
    <div className="space-y-5">
      <h1 className="text-4xl sm:text-5xl">{t("title")}</h1>
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
