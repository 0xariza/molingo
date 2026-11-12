import {
  CaretRight,
  Check,
  ClipboardText,
  Exam,
  Receipt,
  Sparkle,
  VideoCamera,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { JoinLink } from "@/components/classroom/join-link";
import { Mascot } from "@/components/mascot";
import { nextSession } from "@/components/student/schedule";
import { buttonClass } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import {
  formatDate,
  formatDayParts,
  formatNumber,
  formatTime,
  formatToman,
  tehranDateKey,
} from "@/lib/format";
import { classTitle } from "@/lib/names";
import { learnerAssessments } from "@/server/assessments/assessments";
import { requireStudent } from "@/server/auth/current";
import { learnerBills } from "@/server/billing/learner";
import { learnerHomework } from "@/server/homework/submissions";
import { learnerPaths } from "@/server/paths/station-check";
import { learnerSchedule } from "@/server/scheduling/learner";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Student");
  return { title: t("title") };
}

export default function StudentHome() {
  return (
    <Suspense
      fallback={<div aria-hidden="true" className="h-64 animate-pulse rounded-card bg-mist" />}
    >
      <Home />
    </Suspense>
  );
}

/** One thing waiting for the learner: icon, what it is, a line of detail, and where it leads. */
function Task({
  href,
  icon,
  tint,
  title,
  detail,
}: {
  href: "/app/homework" | "/app/path" | "/app/bills";
  icon: ReactNode;
  tint: string;
  title: string;
  detail: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="group flex h-full min-h-20 items-center gap-4 rounded-card border border-hairline bg-white px-4 py-3 transition hover:border-brand hover:shadow-[0_8px_24px_rgba(7,30,54,.08)]"
      >
        <span
          aria-hidden
          className={`grid size-12 shrink-0 place-items-center rounded-2xl ${tint}`}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1 leading-snug">
          <b className="block text-base text-ocean">{title}</b>
          <span className="block text-sm">{detail}</span>
        </span>
        <CaretRight
          aria-hidden
          size={20}
          className="icon-directional shrink-0 text-line transition group-hover:text-ocean"
        />
      </Link>
    </li>
  );
}

async function Home() {
  const user = await requireStudent();
  const now = new Date();
  const [t, tp, ta, tc, locale, sessions, paths, bills, homework, exams] = await Promise.all([
    getTranslations("Student.home"),
    getTranslations("Student.path"),
    getTranslations("Student.assessment"),
    getTranslations("Classroom"),
    getLocale() as Promise<Locale>,
    learnerSchedule(user.id, now),
    learnerPaths(user.id),
    learnerBills(user.id, now),
    learnerHomework(user.id),
    learnerAssessments(user.id),
  ]);
  const n = (v: number) => formatNumber(v, locale);
  const stations = paths[0]?.stations ?? [];
  const current = stations.find((s) => s.state === "current");
  const done = stations.filter((s) => s.state === "done").length;
  const next = nextSession(sessions);
  const todo = homework.filter((h) => h.status === null || h.status === "needs_revision");
  const soonest = todo
    .filter((h) => h.dueAt)
    .sort((a, b) => a.dueAt!.getTime() - b.dueAt!.getTime())[0];
  const openExam = exams.find((e) => !e.submittedAt);
  const tasks = [
    todo.length > 0 && (
      <Task
        key="hw"
        href="/app/homework"
        icon={<ClipboardText size={24} />}
        tint="bg-cinnamon-soft text-cinnamon-ink"
        title={t("hwOpen", { n: todo.length })}
        detail={
          soonest
            ? t("hwDue", { date: formatDate(soonest.dueAt!, locale, { year: false }) })
            : t("hwNoDue")
        }
      />
    ),
    openExam && (
      <Task
        key="exam"
        href="/app/path"
        icon={<Exam size={24} />}
        tint="bg-mist text-brand"
        title={ta(openExam.kind === "stage" ? "kindStage" : "kindFinal")}
        detail={ta("minutes", { n: openExam.minutes })}
      />
    ),
    bills.due > 0 && (
      <Task
        key="bill"
        href="/app/bills"
        icon={<Receipt size={24} />}
        tint="bg-surface text-ocean"
        title={formatToman(bills.due, locale)}
        detail={t("billLead")}
      />
    ),
  ].filter(Boolean);

  const tasksRow = (
    <section aria-labelledby="tasks" className="space-y-3">
      <h2 id="tasks" className="font-sans text-lg font-extrabold normal-case tracking-normal">
        {t("tasksTitle")}
      </h2>
      {tasks.length > 0 ? (
        <ul className="grid gap-4 md:grid-cols-3">{tasks}</ul>
      ) : (
        <p className="flex items-center gap-3 rounded-card bg-[#f1fbf5] p-4 text-base font-bold text-[#14613a]">
          <span
            aria-hidden
            className="grid size-10 place-items-center rounded-full bg-[#1f7a4d] text-white"
          >
            <Check weight="bold" size={20} />
          </span>
          {t("tasksNone")}
        </p>
      )}
    </section>
  );

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-sm font-bold text-brand">{formatDate(now, locale, { year: false })}</p>
        <h1 className="text-3xl sm:text-4xl">{t("greeting", { name: user.displayName })}</h1>
      </header>

      {next ? (
        <section
          aria-labelledby="next-class"
          className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-card border border-hairline bg-white p-4 sm:px-6"
        >
          <h2 id="next-class" className="sr-only">
            {t("nextTitle")}
          </h2>
          <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-ocean text-center leading-tight text-white">
            <span>
              <b className="block text-2xl font-extrabold">
                {formatDayParts(next.startsAt, locale).day}
              </b>
              <span className="text-xs text-[#f9c9a6]">
                {formatDayParts(next.startsAt, locale).month}
              </span>
            </span>
          </span>
          <span className="min-w-0 flex-1 leading-snug">
            <span className="block text-sm font-bold text-cinnamon-ink">
              {next.phase === "live"
                ? t("liveNow")
                : tehranDateKey(next.startsAt) === tehranDateKey(now)
                  ? t("today")
                  : t("nextTitle")}
            </span>
            <b dir="auto" className="block text-lg text-ocean">
              {classTitle(next, locale)} · {next.level}
            </b>
            <span className="block text-sm">
              {t("timeLine", {
                day: formatDayParts(next.startsAt, locale).weekday,
                from: formatTime(next.startsAt, locale),
                to: formatTime(next.endsAt, locale),
              })}
            </span>
          </span>
          <JoinLink
            href={`/app/classroom/${next.id}`}
            role="student"
            startsAt={next.startsAt}
            endsAt={next.endsAt}
            open={next.canJoin}
            className={buttonClass("primary", "w-full sm:w-auto")}
          >
            <VideoCamera aria-hidden size={20} weight="fill" />
            {tc("join")}
          </JoinLink>
        </section>
      ) : (
        <section
          aria-labelledby="next-class"
          className="rounded-card border border-hairline bg-white p-5"
        >
          <h2
            id="next-class"
            className="font-sans text-lg font-extrabold normal-case tracking-normal"
          >
            {t("nextTitle")}
          </h2>
          <p className="text-sm">{t("nextEmpty")}</p>
        </section>
      )}

      <section
        aria-labelledby="hero"
        className="relative overflow-hidden rounded-[32px] bg-ocean p-6 text-white sm:p-10"
      >
        <span
          aria-hidden
          className="absolute -end-16 -top-20 size-72 rounded-full bg-whale/20 blur-2xl"
        />
        <span
          aria-hidden
          className="absolute -bottom-24 start-1/3 size-64 rounded-full bg-cinnamon/25 blur-3xl"
        />
        <div className="relative flex items-center gap-8">
          <div className="min-w-0 flex-1 space-y-5">
            {current ? (
              <>
                <p className="text-sm font-bold text-[#f9c9a6]">
                  {tp("stationOf", {
                    n: n(stations.indexOf(current) + 1),
                    total: n(stations.length),
                  })}
                  {" · "}
                  {tp("sessionOf", {
                    n: n(Math.min(current.held + 1, current.planned)),
                    total: n(current.planned),
                  })}
                </p>
                <h2
                  id="hero"
                  className="font-sans text-2xl font-extrabold normal-case leading-snug tracking-normal text-white sm:text-3xl"
                >
                  <bdi dir="auto">{current.title}</bdi>
                </h2>
                <ul className="flex flex-wrap gap-2">
                  {current.skills.map((k) => {
                    const ready = k.result === "ready";
                    return (
                      <li
                        key={k.id}
                        dir="auto"
                        className={`inline-flex items-center gap-1.5 rounded-pill px-3.5 py-1.5 text-sm font-bold ${
                          ready || k.worked ? "bg-white text-ocean" : "bg-white/15 text-white"
                        }`}
                      >
                        {(ready || k.worked) && (
                          <Check
                            aria-hidden
                            weight="bold"
                            size={14}
                            className="shrink-0 text-[#1f7a4d]"
                          />
                        )}
                        {k.text}
                      </li>
                    );
                  })}
                </ul>
                <div className="flex flex-wrap items-center gap-4 pt-1">
                  <Link href="/app/path" className={buttonClass("sand", "min-h-12 px-7 text-base")}>
                    {t("pathContinue")}
                  </Link>
                  <p className="text-base font-bold text-white/80">
                    {t("stationsDone", { done, total: stations.length })}
                  </p>
                </div>
              </>
            ) : (
              <>
                <h2
                  id="hero"
                  className="font-sans text-3xl font-extrabold normal-case tracking-normal text-white"
                >
                  {t("pathNone")}
                </h2>
              </>
            )}
          </div>
          <Mascot state="open" className="hidden size-36 shrink-0 sm:block lg:size-44" />
        </div>
      </section>

      {tasksRow}

      <section className="flex flex-wrap items-center gap-4 rounded-card bg-whale p-5 text-ocean">
        <span aria-hidden className="grid size-11 place-items-center rounded-2xl bg-white/40">
          <Sparkle size={22} weight="fill" />
        </span>
        <div className="min-w-0 flex-1 leading-snug">
          <p className="text-sm font-extrabold">{t("aiTag")}</p>
          <h2 className="font-sans text-lg font-extrabold normal-case tracking-normal">
            {t("aiTitle")}
          </h2>
          <p className="text-sm text-ocean/80">{t("aiBody")}</p>
        </div>
      </section>
    </div>
  );
}
