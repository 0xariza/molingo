import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BackLink } from "@/components/admin/learners/back-link";
import { NewSourceForm } from "@/components/admin/sources/new-source-form";
import { FormSkeleton } from "@/components/ui/form-skeleton";
import { requireTeacher } from "@/server/auth/current";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.sources");
  return { title: t("form.newTitle") };
}

export default function NewSourcePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Suspense fallback={<FormSkeleton />}>
        <NewSource />
      </Suspense>
    </div>
  );
}

async function NewSource() {
  await requireTeacher();
  const t = await getTranslations("Admin.sources");
  return (
    <>
      <BackLink href="/admin/sources" label={t("title")} />
      <header>
        <h1 className="text-4xl sm:text-5xl">{t("form.newTitle")}</h1>
        <p className="mt-1">{t("form.lead")}</p>
      </header>
      <NewSourceForm />
    </>
  );
}
