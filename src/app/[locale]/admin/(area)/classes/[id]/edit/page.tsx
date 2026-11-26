import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { BackLink } from "@/components/admin/learners/back-link";
import { DeleteClass } from "@/components/admin/classes/delete-class";
import { EditClassForm } from "@/components/admin/classes/edit-class-form";
import { EditScheduleForm } from "@/components/admin/classes/edit-schedule-form";
import { FormSkeleton } from "@/components/ui/form-skeleton";
import { classTitle } from "@/lib/names";
import { tehranDateKey } from "@/lib/format";
import { nextDateOn } from "@/lib/schedule";
import { requireTeacher } from "@/server/auth/current";
import { getClassDetail } from "@/server/classes/sessions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.classes");
  return { title: t("form.editTitle") };
}

export default async function EditClassPage({
  params,
}: PageProps<"/[locale]/admin/classes/[id]/edit">) {
  const t = await getTranslations("Admin.classes");
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-4xl sm:text-5xl">{t("form.editTitle")}</h1>
      <Suspense fallback={<FormSkeleton />}>
        <EditClass params={params} />
      </Suspense>
    </div>
  );
}

async function EditClass({ params }: { params: Promise<{ id: string }> }) {
  const { teacherId } = await requireTeacher();
  const { id } = await params;
  const valid = z.uuid().safeParse(id);
  const cls = valid.success ? await getClassDetail(teacherId, valid.data) : null;
  if (!cls || cls.state === "archived") notFound();
  const title = classTitle(cls, await getLocale());
  const today = tehranDateKey(new Date());
  const regular = cls.sessions.filter((s) => s.kind === "class");
  const upcoming = regular.filter((s) => s.phase === "upcoming");
  // The new schedule applies from the next session to come, or the next class day.
  const from = upcoming[0]
    ? tehranDateKey(upcoming[0].startsAt)
    : nextDateOn(
        today,
        cls.slots.map((s) => s.weekday),
      );
  return (
    <>
      <BackLink href={`/admin/classes/${cls.id}`} label={title} />
      <EditClassForm cls={cls} />
      <EditScheduleForm
        id={cls.id}
        defaults={{ ...cls, startsOn: from }}
        kept={regular.length - upcoming.length}
        today={today}
      />
      <DeleteClass id={cls.id} name={title} />
    </>
  );
}
