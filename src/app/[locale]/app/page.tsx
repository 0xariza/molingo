import { Sparkle, VideoCamera } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";
import type { Locale } from "@/i18n/routing";
import { formatDate } from "@/lib/format";
import { requireStudent } from "@/server/auth/current";

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
 * Classes (M4/M5), homework (M8) and the roadmap (M9) fill this page as they ship; until then the
 * next-class card shows where they will appear.
 */
async function Home() {
  const [user, t, locale] = await Promise.all([
    requireStudent(),
    getTranslations("Student.home"),
    getLocale() as Promise<Locale>,
  ]);
  await connection();

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-brand">
          {formatDate(new Date(), locale, { year: false })}
        </p>
        <h1 className="font-sans text-xl font-extrabold normal-case tracking-normal sm:text-2xl">
          {t("greeting", { name: user.displayName })}
        </h1>
      </header>

      <section
        aria-labelledby="next-class"
        className="flex flex-wrap items-center gap-5 rounded-[1.75rem] border border-line/40 bg-white p-6"
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

      <section className="space-y-2 rounded-[1.75rem] bg-whale p-6 text-ocean">
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
