import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { BackLink } from "@/components/admin/learners/back-link";
import { LearnerForm } from "@/components/admin/learners/learner-form";
import { FormSkeleton } from "@/components/ui/form-skeleton";
import { formatPhone } from "@/lib/phone";
import { requireTeacher } from "@/server/auth/current";
import { getLearner } from "@/server/students/learners";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.learners.form");
  return { title: t("editTitle") };
}

export default async function EditLearnerPage({
  params,
}: PageProps<"/[locale]/admin/students/[id]/edit">) {
  const t = await getTranslations("Admin.learners.form");
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-4xl sm:text-5xl">{t("editTitle")}</h1>
      <Suspense fallback={<FormSkeleton />}>
        <EditLearner params={params} />
      </Suspense>
    </div>
  );
}

async function EditLearner({ params }: { params: Promise<{ id: string }> }) {
  const { teacherId } = await requireTeacher();
  const { id } = await params;
  const valid = z.uuid().safeParse(id);
  const learner = valid.success ? await getLearner(teacherId, valid.data) : null;
  if (!learner) notFound();

  return (
    <>
      <BackLink href={`/admin/students/${learner.id}`} label={learner.fullNameFa} />
      <LearnerForm
        mode="edit"
        id={learner.id}
        defaults={{
          fullNameFa: learner.fullNameFa,
          fullNameEn: learner.fullNameEn ?? "",
          phone: formatPhone(learner.phone),
          email: learner.email ?? "",
          messengerHandle: learner.messengerHandle ?? "",
          notes: learner.notes ?? "",
        }}
      />
    </>
  );
}
