import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { scheduleText } from "@/components/admin/classes/schedule-text";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatNumber, formatTime } from "@/lib/format";
import { classTitle } from "@/lib/names";
import { requireStudent } from "@/server/auth/current";
import { learnerHomework } from "@/server/homework/submissions";
import { learnerClasses } from "@/server/students/classes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Student.classes");
  return { title: t("title") };
}

export default function LearnerClassesPage() {
  return (
    <Suspense
      fallback={<div aria-hidden="true" className="h-64 animate-pulse rounded-card bg-mist" />}
    >
      <Classes />
    </Suspense>
  );
}

async function Classes() {
  const user = await requireStudent();
  const now = new Date();
  const [t, tc, locale, classes, homework] = await Promise.all([
    getTranslations("Student.classes"),
    getTranslations("Admin.classes"),
    getLocale() as Promise<Locale>,
    learnerClasses(user.id, now),
    learnerHomework(user.id),
  ]);
  const n = (v: number) => formatNumber(v, locale);
  const days = tc.raw("weekdaysShort") as string[];
  const running = classes.filter((c) => !c.finished);
  const finished = classes.filter((c) => c.finished);
  const open = (classId: string) =>
    homework.filter(
      (h) => h.classId === classId && (h.status === null || h.status === "needs_revision"),
    ).length;

  return (
    <div className="space-y-5">
      <h1 className="text-4xl sm:text-5xl">{t("title")}</h1>
      {classes.length === 0 && (
        <p className="rounded-card border border-hairline bg-white p-6">{t("empty")}</p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {running.map((c) => {
          const teacher = locale === "en" ? c.teacherNameEn : c.teacherNameFa;
          const due = open(c.id);
          return (
            <article
              key={c.id}
              className="space-y-4 rounded-card border border-hairline bg-white p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-sans text-xl font-extrabold normal-case tracking-normal">
                    {classTitle(c, locale)}
                  </h2>
                  <p className="text-sm">
                    {t(`type.${c.type}`)} · {t("with", { teacher })} ·{" "}
                    {scheduleText(c.slots, days, tc("and"), locale)}
                  </p>
                </div>
                <span
                  dir="ltr"
                  className="grid size-11 shrink-0 place-items-center rounded-xl bg-ocean font-extrabold text-white"
                >
                  {c.level}
                </span>
              </div>
              <div className="space-y-1.5">
                <div aria-hidden="true" className="h-2 overflow-hidden rounded-pill bg-mist">
                  <div
                    className="h-2 bg-brand"
                    style={{
                      width: `${Math.min(100, Math.round((c.held / c.sessionCount) * 100))}%`,
                    }}
                  />
                </div>
                <p className="text-sm">{t("held", { held: c.held, total: c.sessionCount })}</p>
              </div>
              <p>
                <strong className="text-ocean">{t("next")}</strong>{" "}
                {c.nextStartsAt
                  ? `${formatDate(c.nextStartsAt, locale, { year: false })} · ${formatTime(c.nextStartsAt, locale)}`
                  : t("nextNone")}
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/app/homework"
                  className="inline-flex min-h-touch items-center gap-2 rounded-pill bg-surface px-4 font-bold text-ocean hover:bg-mist"
                >
                  {t("homework")}
                  {due > 0 && (
                    <span className="grid h-5.5 min-w-5.5 place-items-center rounded-pill bg-sand px-1.5 text-xs font-extrabold text-ocean">
                      {n(due)}
                    </span>
                  )}
                </Link>
                <Link
                  href="/app/schedule"
                  className="inline-flex min-h-touch items-center rounded-pill bg-surface px-4 font-bold text-ocean hover:bg-mist"
                >
                  {t("sessions")}
                </Link>
              </div>
            </article>
          );
        })}
      </div>
      {finished.length > 0 && (
        <details className="rounded-card border border-hairline bg-white px-5 py-1">
          <summary className="flex min-h-touch cursor-pointer items-center font-bold text-ocean">
            {t("finished", { count: finished.length })}
          </summary>
          <ul className="divide-y divide-mist pb-2">
            {finished.map((c) => (
              <li key={c.id} className="py-2.5">
                {t("finishedLine", { name: classTitle(c, locale), total: c.sessionCount })}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
