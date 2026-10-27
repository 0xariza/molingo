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
import { homeTeacherSlug } from "@/server/teachers/teachers";

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
  return (
    <>
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
