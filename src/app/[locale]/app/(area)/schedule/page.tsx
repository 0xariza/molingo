import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { NextSessionCard, nextSession, SessionList } from "@/components/student/schedule";
import type { Locale } from "@/i18n/routing";
import { requireStudent } from "@/server/auth/current";
import { learnerSchedule } from "@/server/scheduling/learner";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Student.schedule");
  return { title: t("title") };
}

export default function MySchedulePage() {
  return (
    <Suspense
      fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-card bg-mist" />}
    >
      <MySchedule />
    </Suspense>
  );
}

async function MySchedule() {
  // The session check comes first: it marks the request dynamic before the clock is read.
  const user = await requireStudent();
  const now = new Date();
  const [t, locale, sessions] = await Promise.all([
    getTranslations("Student.schedule"),
    getLocale() as Promise<Locale>,
    learnerSchedule(user.id, now),
  ]);
  const next = nextSession(sessions);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header>
        <p className="text-sm font-bold text-brand">{user.displayName}</p>
        <h1 className="text-4xl">{t("title")}</h1>
      </header>
      {next && <NextSessionCard session={next} now={now} locale={locale} />}
      <SessionList sessions={sessions} now={now} locale={locale} />
    </div>
  );
}
