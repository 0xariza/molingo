import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { CoveredForm } from "@/components/admin/after-class/covered-form";
import { StationCheck } from "@/components/admin/after-class/station-check";
import { HomeworkList } from "@/components/admin/after-class/homework-list";
import { BackLink } from "@/components/admin/learners/back-link";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatTime } from "@/lib/format";
import { classTitle } from "@/lib/names";
import { requireTeacher } from "@/server/auth/current";
import { getAfterClass } from "@/server/homework/after-class";
import { getStationCheck } from "@/server/paths/station-check";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.afterClass");
  return { title: t("title") };
}

export default function AfterClassPage({ params }: PageProps<"/[locale]/admin/sessions/[id]">) {
  return (
    <div className="max-w-3xl space-y-5">
      <Suspense
        fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-card bg-mist" />}
      >
        <AfterClassView params={params} />
      </Suspense>
    </div>
  );
}

const card = "space-y-4 rounded-card border border-hairline bg-white p-6";
const heading = "font-sans text-lg font-extrabold normal-case tracking-normal";

async function AfterClassView({ params }: { params: Promise<{ id: string }> }) {
  const { teacherId } = await requireTeacher();
  const { id } = await params;
  const valid = z.uuid().safeParse(id);
  const page = valid.success ? await getAfterClass(teacherId, valid.data) : null;
  if (!page) notFound();
  const [t, locale, check] = await Promise.all([
    getTranslations("Admin.afterClass"),
    getLocale() as Promise<Locale>,
    getStationCheck(teacherId, page.sessionId),
  ]);
  const name = classTitle(page, locale);
  const date = formatDate(page.startsAt, locale);
  const time = `${formatTime(page.startsAt, locale)}–${formatTime(page.endsAt, locale)}`;

  return (
    <>
      <BackLink href={`/admin/classes/${page.classId}`} label={name} />
      <header className="space-y-1">
        <p className="text-sm font-bold text-cinnamon-ink">
          {page.station
            ? t("eyebrowStation", {
                class: name,
                station: page.station.position,
                n: page.station.sessionInStation,
                of: page.station.of,
              })
            : t("eyebrow", { class: name })}
        </p>
        <h1 className="text-4xl sm:text-5xl">{t("title")}</h1>
        <p>
          {page.number
            ? t("sub", {
                n: page.number,
                total: page.sessionCount,
                date,
                time,
                present: page.present,
              })
            : t("subMakeup", { date, time, present: page.present })}
        </p>
      </header>

      <section aria-labelledby="covered-title" className={card}>
        <div>
          <h2 id="covered-title" className={heading}>
            {t("covered")}
          </h2>
          <p className="text-sm">{t("coveredHint")}</p>
        </div>
        <CoveredForm page={page} />
      </section>

      {check && (
        <section aria-labelledby="check-title" className={card}>
          <div>
            <h2 id="check-title" className={heading}>
              {t("check.title")}
            </h2>
            <p className="text-sm">{t("check.hint")}</p>
          </div>
          <StationCheck sessionId={page.sessionId} check={check} />
        </section>
      )}

      <section aria-labelledby="homework-title" className="space-y-3">
        <div>
          <h2 id="homework-title" className={heading}>
            {t("homework")}
          </h2>
          <p className="text-sm">{t("homeworkHint")}</p>
        </div>
        <HomeworkList page={page} />
      </section>
    </>
  );
}
