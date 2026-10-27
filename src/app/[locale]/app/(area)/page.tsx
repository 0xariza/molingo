import { Sparkle, VideoCamera } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import type { Locale } from "@/i18n/routing";
import { formatDate } from "@/lib/format";
import { NextSessionCard, nextSession } from "@/components/student/schedule";
import { Link } from "@/i18n/navigation";
import { requireStudent } from "@/server/auth/current";
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

/**
 * The next session (M5); homework (M8) and the roadmap (M9) fill this page as they ship. Until the
 * learner has a class, the next-class card says where it will appear.
 */
async function Home() {
  const user = await requireStudent();
  const now = new Date();
  const [t, locale, sessions] = await Promise.all([
    getTranslations("Student.home"),
    getLocale() as Promise<Locale>,
    learnerSchedule(user.id, now),
  ]);
  const next = nextSession(sessions);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-brand">{formatDate(now, locale, { year: false })}</p>
        <h1 className="font-sans text-xl font-extrabold normal-case tracking-normal sm:text-2xl">
          {t("greeting", { name: user.displayName })}
        </h1>
      </header>

      {next ? (
        <div className="space-y-2">
          <NextSessionCard session={next} now={now} locale={locale} />
          <Link
            href="/app/schedule"
            className="inline-flex min-h-touch items-center font-bold text-brand hover:underline"
          >
            {t("seeAll")}
          </Link>
        </div>
      ) : (
        <section
          aria-labelledby="next-class"
          className="flex flex-wrap items-center gap-5 rounded-card border border-hairline bg-white p-6"
        >
          <span className="grid size-13 shrink-0 place-items-center rounded-2xl bg-mist text-brand">
            <VideoCamera aria-hidden size={26} />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="next-class"
              className="font-sans text-lg font-extrabold normal-case tracking-normal"
            >
              {t("nextTitle")}
            </h2>
            <p className="mt-1">{t("nextEmpty")}</p>
          </div>
        </section>
      )}

      <section className="space-y-2 rounded-card bg-whale p-6 text-ocean">
        <p className="flex items-center gap-2 text-sm font-extrabold">
          <Sparkle aria-hidden size={18} weight="fill" />
          {t("aiTag")}
        </p>
        <h2 className="text-3xl sm:text-4xl">{t("aiTitle")}</h2>
        <p className="max-w-xl text-ocean/80">{t("aiBody")}</p>
      </section>
    </div>
  );
}
