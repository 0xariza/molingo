import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { AiAssistant } from "@/components/landing/ai-assistant";
import { Booking } from "@/components/landing/booking";
import { ClassFormats } from "@/components/landing/class-formats";
import { Faq } from "@/components/landing/faq";
import { Hero } from "@/components/landing/hero";
import { JsonLd } from "@/components/json-ld";
import { Highlights } from "@/components/landing/highlights";
import { SiteFooter } from "@/components/landing/site-footer";
import { TeacherHeader } from "@/components/landing/teacher-header";
import { TwoGuides } from "@/components/landing/two-guides";
import type { Locale } from "@/i18n/routing";
import { localeAlternates, siteUrl, socialMeta } from "@/lib/site";
import { teacherPage } from "@/server/teachers/teachers";

// Look the teacher up before streaming starts, so an unknown address is a real 404 (not a 200).
export const instant = false;

// The lookup also runs here so an unknown address is a real 404: metadata resolves before the
// response starts, while notFound() inside the page can arrive after a 200 was already sent.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const teacher = await teacherPage(slug, locale as Locale);
  if (!teacher) notFound();
  const t = await getTranslations("Metadata");
  const vars = { brand: teacher.brandName, teacher: teacher.name };
  return {
    title: { absolute: t("teacherTitle", vars) },
    description: t("teacherDescription", vars),
    alternates: localeAlternates(locale as Locale, `/${teacher.slug}`),
    ...socialMeta(
      locale as Locale,
      `/${teacher.slug}`,
      t("teacherTitle", vars),
      t("teacherDescription", vars),
    ),
  };
}

/** A teacher's public page: hoopo.ir/<slug> (PLAN, Multi-teacher; design: MonaPage). */
export default async function TeacherPage({ params }: PageProps<"/[locale]/[slug]">) {
  const { locale, slug } = await params;
  const teacher = await teacherPage(slug, locale as Locale);
  if (!teacher) notFound();
  const name = teacher.name;
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "EducationalOrganization",
          name: teacher.brandName,
          url: `${siteUrl}/${locale}/${teacher.slug}`,
          ...(teacher.bio ? { description: teacher.bio } : {}),
          founder: { "@type": "Person", name },
        }}
      />
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
