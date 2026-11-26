import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { locale } from "next/root-params";
import { Suspense } from "react";
import {
  HomeFaq,
  HomeFooter,
  HomeHeader,
  HomeHero,
  LearnersSection,
  LoopSection,
  MoneySection,
  PageSection,
  ProgressSection,
  StartSection,
  TimeSection,
} from "@/components/home/sections";
import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { JsonLd } from "@/components/json-ld";
import { localeAlternates, platformHomeReady, siteUrl, socialMeta } from "@/lib/site";
import { homeTeacherSlug } from "@/server/teachers/teachers";

export async function generateMetadata(): Promise<Metadata> {
  const [t, current] = await Promise.all([getTranslations("Metadata"), locale()]);
  const lang = current as Locale;
  return {
    title: { absolute: t("homeTitle") },
    description: t("homeDescription"),
    alternates: localeAlternates(lang),
    robots: platformHomeReady ? undefined : { index: false, follow: true },
    ...socialMeta(lang, "", t("homeTitle"), t("homeDescription")),
  };
}

/**
 * hoopo.ir: the platform page for teachers (M6d) once PLATFORM_HOME=on. Until its placeholders
 * are real (PLAN, M6d) it stays off and the first teacher's page (Mona) opens instead.
 */
export default function HomePage() {
  return (
    <Suspense>
      <Home />
    </Suspense>
  );
}

async function Home() {
  const [slug, current] = await Promise.all([homeTeacherSlug(), locale()]);
  if (process.env.PLATFORM_HOME !== "on") {
    if (!slug) notFound();
    return redirect({ href: `/${slug}`, locale: current as Locale });
  }
  const teacherHref = slug ? `/${current}/${slug}` : "#page";
  const [meta, faq] = await Promise.all([getTranslations("Metadata"), getTranslations("Home.faq")]);
  const items = Object.values(
    (faq.raw as (key: string) => unknown)("items") as Record<string, { q: string; a: string }>,
  );
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: "Hoopo",
              url: siteUrl,
              logo: `${siteUrl}/icon-512.png`,
              description: meta("homeDescription"),
            },
            {
              "@type": "FAQPage",
              mainEntity: items.map(({ q, a }) => ({
                "@type": "Question",
                name: q,
                acceptedAnswer: { "@type": "Answer", text: a },
              })),
            },
          ],
        }}
      />
      <HomeHeader />
      <main id="main" className="flex-1">
        <HomeHero teacherHref={teacherHref} />
        <LoopSection />
        <TimeSection />
        <MoneySection />
        <ProgressSection />
        <PageSection teacherHref={teacherHref} />
        <LearnersSection teacherHref={teacherHref} />
        <HomeFaq />
        <StartSection />
      </main>
      <HomeFooter />
    </>
  );
}
