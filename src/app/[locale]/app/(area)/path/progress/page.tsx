import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { RecordingForm } from "@/components/student/recording-form";
import { requireStudent } from "@/server/auth/current";
import { learnerProgress } from "@/server/paths/progress";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Student.progress");
  return { title: t("title") };
}

export default function ProgressPage() {
  return (
    <Suspense
      fallback={<div aria-hidden="true" className="h-64 animate-pulse rounded-card bg-mist" />}
    >
      <Progress />
    </Suspense>
  );
}

async function Progress() {
  const user = await requireStudent();
  const [t, p] = await Promise.all([getTranslations("Student.progress"), learnerProgress(user.id)]);
  const hasBefore = p?.recordings.some((r) => r.kind === "before");
  const card = "space-y-3 rounded-card border border-hairline bg-white p-5";

  return (
    <div className="space-y-5">
      <h1 className="text-4xl sm:text-5xl">{t("title")}</h1>
      <section className={`${card} grid grid-cols-3 text-center`}>
        <p>
          <b className="block text-2xl text-ocean">
            {t("of", { n: p?.stationsDone ?? 0, total: p?.stationsTotal ?? 0 })}
          </b>
          {t("stations")}
        </p>
        <p>
          <b className="block text-2xl text-ocean">{p?.ready ?? 0}</b>
          {t("ready")}
        </p>
        <p>
          <b className="block text-2xl text-ocean">{p?.again ?? 0}</b>
          {t("again")}
        </p>
      </section>
      <section aria-labelledby="rec-title" className={card}>
        <h2 id="rec-title" className="font-sans text-lg font-extrabold normal-case tracking-normal">
          {t("beforeAfter")}
        </h2>
        <p className="text-sm">{t("beforeAfterHint")}</p>
        {p?.recordings.map((r) => (
          <div key={r.id} className="space-y-1">
            <p className="text-sm font-bold text-cinnamon-ink">{t(r.kind)}</p>
            <audio controls preload="none" src={`/api/files/${r.fileId}`} className="w-full" />
          </div>
        ))}
        <RecordingForm kind={hasBefore ? "after" : "before"} />
      </section>
    </div>
  );
}
