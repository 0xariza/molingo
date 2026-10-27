import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { z } from "zod";
import { BackLink } from "@/components/admin/learners/back-link";
import { ClassForm, type ClassFormDefaults } from "@/components/admin/classes/class-form";
import { FormSkeleton } from "@/components/ui/form-skeleton";
import type { Locale } from "@/i18n/routing";
import { tehranDateKey } from "@/lib/format";
import { classTitle } from "@/lib/names";
import { requireTeacher } from "@/server/auth/current";
import { listCandidates, nextCourseDefaults } from "@/server/classes/classes";
import { getClassDetail } from "@/server/classes/sessions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.classes");
  return { title: t("form.newTitle") };
}

export default function NewClassPage({ searchParams }: PageProps<"/[locale]/admin/classes/new">) {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Suspense fallback={<FormSkeleton />}>
        <NewClass searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const blank: ClassFormDefaults = {
  nameFa: "",
  nameEn: null,
  level: "A1",
  type: "group",
  capacity: 3,
  sessionCount: 12,
  sessionMinutes: 90,
  slots: [],
  startsOn: "",
  price: null,
  description: null,
  isPublic: false,
  studentIds: [],
};

/** With `?from=<class id>` (a finished class), the form starts as that class's next course. */
async function NewClass({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { teacherId } = await requireTeacher();
  const [t, locale, { from }, candidates] = await Promise.all([
    getTranslations("Admin.classes"),
    getLocale() as Promise<Locale>,
    searchParams,
    listCandidates(teacherId),
  ]);
  const today = tehranDateKey(new Date());
  const fromId = z.uuid().safeParse(from);
  const next = fromId.success ? await nextCourseDefaults(teacherId, fromId.data, today) : null;
  const fromClass = next ? await getClassDetail(teacherId, next.fromClassId) : null;

  return (
    <>
      <BackLink
        href={fromClass ? `/admin/classes/${fromClass.id}` : "/admin/classes"}
        label={fromClass ? classTitle(fromClass, locale) : t("back")}
      />
      <h1 className="text-4xl sm:text-5xl">{next ? t("form.nextTitle") : t("form.newTitle")}</h1>
      {fromClass && (
        <p className="rounded-2xl border border-sand bg-[#fdf3dc] px-4 py-3 text-[#4d3700]">
          {t("form.nextLead", { name: classTitle(fromClass, locale) })}
        </p>
      )}
      <ClassForm
        defaults={next ?? blank}
        candidates={candidates}
        today={today}
        fromClassId={next?.fromClassId}
      />
    </>
  );
}
