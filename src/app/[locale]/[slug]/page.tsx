import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AiAssistant } from "@/components/landing/ai-assistant";
import { Booking } from "@/components/landing/booking";
import { ClassFormats } from "@/components/landing/class-formats";
import { Faq } from "@/components/landing/faq";
import { Hero } from "@/components/landing/hero";
import { Highlights } from "@/components/landing/highlights";
import { SiteFooter } from "@/components/landing/site-footer";
import { TeacherHeader } from "@/components/landing/teacher-header";
import { TwoGuides } from "@/components/landing/two-guides";
import type { Locale } from "@/i18n/routing";
import { teacherPage } from "@/server/teachers/teachers";

/** A teacher's public page: hoopo.ir/<slug> (PLAN, Multi-teacher; design: MonaPage). */
export default function TeacherPage({ params }: PageProps<"/[locale]/[slug]">) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="min-h-dvh bg-surface" />}>
      <Page params={params} />
    </Suspense>
  );
}

async function Page({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const teacher = await teacherPage(slug, locale as Locale);
  if (!teacher) notFound();
  const name = teacher.name;
  return (
    <>
      <TeacherHeader brand={teacher.brandName} teacher={name} />
      <main id="main" className="flex-1">
        <Hero teacher={name} />
        <Highlights />
        <TwoGuides teacher={name} bio={teacher.bio} />
        <AiAssistant />
        <ClassFormats teacherId={teacher.id} teacher={name} />
        <Booking teacherId={teacher.id} teacher={name} />
        <Faq teacher={name} />
      </main>
      <SiteFooter teacher={name} brand={teacher.brandName} />
    </>
  );
}
