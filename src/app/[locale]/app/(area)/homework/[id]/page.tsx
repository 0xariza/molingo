import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { FileLink } from "@/components/homework/file-link";
import { AnswerForm } from "@/components/student/answer-form";
import { homeworkBadge } from "@/components/student/homework-list";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatTime } from "@/lib/format";
import { classTitle } from "@/lib/names";
import { requireStudent } from "@/server/auth/current";
import { learnerAssignment } from "@/server/homework/submissions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Student.homework");
  return { title: t("title") };
}

export default function HomeworkDetailPage({ params }: PageProps<"/[locale]/app/homework/[id]">) {
  return (
    <Suspense
      fallback={<div aria-hidden="true" className="h-64 animate-pulse rounded-card bg-mist" />}
    >
      <Detail params={params} />
    </Suspense>
  );
}

const card = "space-y-3 rounded-card border border-hairline bg-white p-5";

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStudent();
  const id = z.uuid().safeParse((await params).id);
  const hw = id.success ? await learnerAssignment(user.id, id.data) : null;
  if (!hw) notFound();

  const now = new Date();
  const [t, locale] = await Promise.all([
    getTranslations("Student.homework"),
    getLocale() as Promise<Locale>,
  ]);
  const badge = await homeworkBadge(hw, now);
  const teacher = locale === "en" ? hw.teacherNameEn : hw.teacherNameFa;
  const cls = classTitle({ nameFa: hw.classNameFa, nameEn: hw.classNameEn }, locale);
  const reviewed = hw.status === "reviewed";

  return (
    <div className="space-y-5">
      <Link
        href="/app/homework"
        className="inline-flex min-h-touch items-center gap-1.5 font-bold text-brand hover:underline"
      >
        <ArrowLeft aria-hidden size={18} className="icon-directional" />
        {t("back")}
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-cinnamon-ink">{t(`types.${hw.type}`)}</p>
          <h1 dir="auto" className="text-3xl sm:text-4xl">
            {hw.title}
          </h1>
          <p className="mt-1">
            {hw.dueAt
              ? t("due", {
                  date: `${formatDate(hw.dueAt, locale, { year: false })} · ${formatTime(hw.dueAt, locale)}`,
                })
              : t("noDue")}
            {" · "}
            {cls}
          </p>
          {hw.submittedAt && (
            <p className="text-sm">
              {t("sentOn", { date: formatDate(hw.submittedAt, locale, { year: false }) })}
              {hw.late && <span className="font-bold text-[#a64916]"> · {t("late")}</span>}
            </p>
          )}
        </div>
        <span
          className={`rounded-pill px-3 py-1 text-sm font-bold ${
            badge.urgent ? "bg-[#fcefd3] text-[#8a520e]" : "bg-mist text-brand"
          }`}
        >
          {badge.label}
        </span>
      </header>

      {(hw.body || hw.files.length > 0) && (
        <section aria-label={t("attachTitle")} className={card}>
          {hw.body && (
            <p dir="auto" className="whitespace-pre-line text-ocean">
              {hw.body}
            </p>
          )}
          {hw.files.map((f) => (
            <FileLink key={f.id} file={f} locale={locale} />
          ))}
        </section>
      )}

      {hw.feedback && (hw.status === "needs_revision" || reviewed) && (
        <section aria-labelledby="feedback" className="flex gap-4 rounded-card bg-whale/40 p-5">
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-ocean font-extrabold text-white"
          >
            {teacher.slice(0, 1)}
          </span>
          <div className="space-y-1">
            <h2
              id="feedback"
              className="font-sans text-lg font-extrabold normal-case tracking-normal"
            >
              {t("feedbackTitle", { teacher })}
            </h2>
            <p dir="auto" className="whitespace-pre-line text-ocean">
              {hw.feedback}
            </p>
            {hw.status === "needs_revision" && (
              <p className="text-sm">{t("revisionNote", { teacher })}</p>
            )}
          </div>
        </section>
      )}

      {reviewed ? (
        <details className="rounded-card border border-hairline bg-white px-5 py-1">
          <summary className="flex min-h-touch cursor-pointer items-center font-bold text-ocean">
            {t("myAnswer")}
          </summary>
          <div className="space-y-3 pb-4">
            {hw.answer?.body ? (
              <p dir="auto" className="whitespace-pre-line text-ocean">
                {hw.answer.body}
              </p>
            ) : (
              !hw.answer?.files.length && <p>{t("noText")}</p>
            )}
            {hw.answer?.files.map((f) => (
              <FileLink key={f.id} file={f} locale={locale} />
            ))}
          </div>
        </details>
      ) : (
        <AnswerForm
          type={hw.type}
          key={hw.submittedAt?.toISOString() ?? "new"}
          assignmentId={hw.id}
          teacher={teacher}
          body={hw.answer?.body ?? null}
          kept={(hw.answer?.files ?? []).map((f) => ({ id: f.id, name: f.name }))}
          handedIn={Boolean(hw.answer)}
        />
      )}
    </div>
  );
}
