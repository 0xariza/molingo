import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { CoveredForm } from "@/components/admin/after-class/covered-form";
import { SendBar } from "@/components/admin/after-class/send-bar";
import { StationCheck } from "@/components/admin/after-class/station-check";
import { HomeworkList } from "@/components/admin/after-class/homework-list";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { BackLink } from "@/components/admin/learners/back-link";
import { buttonClass } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatTime } from "@/lib/format";
import { classTitle } from "@/lib/names";
import { requireTeacher } from "@/server/auth/current";
import { getAfterClass } from "@/server/homework/after-class";
import { getAssessment } from "@/server/assessments/assessments";
import { getStationCheck } from "@/server/paths/station-check";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.afterClass");
  return { title: t("title") };
}

export default function AfterClassPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/sessions/[id]">) {
  return (
    <div className="max-w-3xl space-y-5">
      <Suspense
        fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-card bg-mist" />}
      >
        <AfterClassView params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const card = "space-y-4 rounded-card border border-hairline bg-white p-6";
const heading = "font-sans text-lg font-extrabold normal-case tracking-normal";

async function AfterClassView({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string | string[] }>;
}) {
  const { teacherId } = await requireTeacher();
  const { id } = await params;
  const valid = z.uuid().safeParse(id);
  const page = valid.success ? await getAfterClass(teacherId, valid.data) : null;
  if (!page) notFound();
  const [t, locale, check, exam] = await Promise.all([
    getTranslations("Admin.afterClass"),
    getLocale() as Promise<Locale>,
    getStationCheck(teacherId, page.sessionId),
    getAssessment(teacherId, page.sessionId),
  ]);
  const sp = await searchParams;
  const steps = [
    {
      key: "covered",
      label: t("covered"),
      hint: t("coveredHint"),
      done: page.topics.length > 0 || Boolean(page.summary),
      status: page.topics.length > 0 || page.summary ? t("done") : t("todo"),
    },
    {
      key: "homework",
      label: t("homework"),
      hint: t("homeworkHint"),
      done: page.homework.length > 0,
      status: t("homeworkCount", { count: page.homework.length }),
    },
    ...(check
      ? [
          {
            key: "check",
            label: t("check.title"),
            hint: t("check.hint"),
            done: check.closed,
            status: check.closed ? t("checkClosed") : t("todo"),
          },
        ]
      : []),
    ...(exam
      ? [
          {
            key: "exam",
            label: t("examTab"),
            hint: t("examLead"),
            done: Boolean(exam.assessment),
            status: exam.assessment ? t("examSet") : t("examNone"),
          },
        ]
      : []),
  ];
  const wanted = Array.isArray(sp.step) ? sp.step[0] : sp.step;
  const index = Math.max(
    0,
    steps.findIndex((x) => x.key === wanted),
  );
  const current = steps[index];
  const step = current.key;
  const next = steps[index + 1];
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

      <nav aria-label={t("stepsLabel")}>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {steps.map((x) => (
            <li key={x.key}>
              <Link
                href={`/admin/sessions/${page.sessionId}?step=${x.key}`}
                aria-current={x.key === step ? "step" : undefined}
                className="flex min-h-16 flex-col justify-center rounded-2xl border-[1.5px] border-hairline bg-white px-3.5 py-2 leading-snug transition hover:border-brand aria-[current=step]:border-brand aria-[current=step]:bg-mist/50"
              >
                <b className="text-ocean">{x.label}</b>
                <span
                  className={`flex items-center gap-1 text-xs font-bold ${x.done ? "text-[#14613a]" : "text-body"}`}
                >
                  {x.done && <CheckCircle aria-hidden weight="fill" size={14} />}
                  {x.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section aria-labelledby="step-title" className={card}>
        <div>
          <h2 id="step-title" className={heading}>
            {current.label}
          </h2>
          <p className="text-sm">{current.hint}</p>
        </div>
        {step === "covered" && <CoveredForm page={page} />}
        {step === "homework" && <HomeworkList page={page} />}
        {step === "check" && check && <StationCheck sessionId={page.sessionId} check={check} />}
        {step === "exam" && exam && (
          <Link
            href={`/admin/sessions/${page.sessionId}/assessment`}
            className={buttonClass("primary", "w-full sm:w-auto")}
          >
            {t(exam.kind === "stage" ? "examStage" : "examFinal")}
          </Link>
        )}
        {next && (
          <div className="flex justify-end border-t border-surface pt-4">
            <Link
              href={`/admin/sessions/${page.sessionId}?step=${next.key}`}
              className={buttonClass("ghost", "w-full sm:w-auto")}
            >
              {t("next", { step: next.label })}
            </Link>
          </div>
        )}
      </section>
      <SendBar
        sessionId={page.sessionId}
        topics={page.topics.length}
        homework={page.homework.length}
        issues={page.homework.flatMap((h, i) =>
          h.issue
            ? [
                t("issueItem", {
                  n: i + 1,
                  issue: t(
                    h.issue === "no_audio"
                      ? "warnNoAudio"
                      : h.issue === "no_text"
                        ? "warnNoText"
                        : "warnNoBody",
                  ),
                }),
              ]
            : [],
        )}
        sent={page.sentAt !== null}
        draftForm={
          step === "covered" ? "covered-form" : step === "homework" ? "homework-form" : null
        }
      />
    </>
  );
}
