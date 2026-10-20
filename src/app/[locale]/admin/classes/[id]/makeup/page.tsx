import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { BackLink } from "@/components/admin/learners/back-link";
import { MakeupForm } from "@/components/admin/classes/makeup-form";
import { FormSkeleton } from "@/components/ui/form-skeleton";
import { tehranDateKey } from "@/lib/format";
import { classTitle } from "@/lib/names";
import { requireAdmin } from "@/server/auth/current";
import { teacherIdFor } from "@/server/classes/classes";
import { getClassDetail, upcomingTeacherSessions } from "@/server/classes/sessions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.classes");
  return { title: t("makeup.title") };
}

export default async function MakeupPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/classes/[id]/makeup">) {
  const t = await getTranslations("Admin.classes");
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Suspense fallback={<FormSkeleton />}>
        <Makeup
          params={params}
          searchParams={searchParams}
          title={t("makeup.title")}
          lead={t("makeup.lead")}
        />
      </Suspense>
    </div>
  );
}

async function Makeup({
  params,
  searchParams,
  title,
  lead,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  title: string;
  lead: string;
}) {
  const admin = await requireAdmin();
  const [{ id }, { replaces }] = await Promise.all([params, searchParams]);
  const valid = z.uuid().safeParse(id);
  const cls = valid.success ? await getClassDetail(valid.data) : null;
  if (!cls || cls.state === "archived" || cls.state === "finished") notFound();
  const busy = await upcomingTeacherSessions(await teacherIdFor(admin.id));
  const replaced = new Set(
    cls.sessions.filter((s) => s.phase !== "cancelled").map((s) => s.replacesNumber),
  );
  const cancelled = cls.sessions
    .filter((s) => s.phase === "cancelled" && !replaced.has(s.number))
    .map((s) => ({ id: s.id, number: s.number, startsAt: s.startsAt }));

  return (
    <>
      <BackLink href={`/admin/classes/${cls.id}`} label={classTitle(cls, await getLocale())} />
      <div>
        <h1 className="text-4xl sm:text-5xl">{title}</h1>
        <p className="mt-1">{lead}</p>
      </div>
      <MakeupForm
        classId={cls.id}
        type={cls.type}
        sessionMinutes={cls.sessionMinutes}
        cancelled={cancelled}
        learners={cls.learners}
        busy={busy}
        today={tehranDateKey(new Date())}
        replaces={cancelled.some((c) => c.id === replaces) ? (replaces as string) : undefined}
      />
    </>
  );
}
