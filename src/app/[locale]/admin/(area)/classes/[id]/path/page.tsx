import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { BackLink } from "@/components/admin/learners/back-link";
import { PathForm } from "@/components/admin/paths/path-form";
import { FormSkeleton } from "@/components/ui/form-skeleton";
import type { Locale } from "@/i18n/routing";
import { classTitle } from "@/lib/names";
import { requireTeacher } from "@/server/auth/current";
import { getClassDetail } from "@/server/classes/sessions";
import { getClassPath, pathSources } from "@/server/paths/class-paths";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.paths");
  return { title: t("title") };
}

export default function ClassPathPage({ params }: PageProps<"/[locale]/admin/classes/[id]/path">) {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Suspense fallback={<FormSkeleton />}>
        <ClassPath params={params} />
      </Suspense>
    </div>
  );
}

async function ClassPath({ params }: { params: Promise<{ id: string }> }) {
  const { teacherId } = await requireTeacher();
  const { id } = await params;
  const valid = z.uuid().safeParse(id);
  const cls = valid.success ? await getClassDetail(teacherId, valid.data) : null;
  if (!cls) notFound();
  const [t, locale, path, sources] = await Promise.all([
    getTranslations("Admin.paths"),
    getLocale() as Promise<Locale>,
    getClassPath(teacherId, cls.id),
    pathSources(teacherId, cls.level),
  ]);
  return (
    <>
      <BackLink href={`/admin/classes/${cls.id}`} label={classTitle(cls, locale)} />
      <h1 className="text-4xl sm:text-5xl">{path ? t("page.editTitle") : t("page.addTitle")}</h1>
      <PathForm
        classId={cls.id}
        level={cls.level}
        sources={sources}
        sessionCount={
          path?.sessionCount ?? cls.sessions.filter((s) => s.phase !== "cancelled").length
        }
        start={path}
      />
    </>
  );
}
