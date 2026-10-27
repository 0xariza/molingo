import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { z } from "zod";
import { BackLink } from "@/components/admin/learners/back-link";
import { LearnerForm } from "@/components/admin/learners/learner-form";
import { FormSkeleton } from "@/components/ui/form-skeleton";
import { splitBookingName } from "@/lib/names";
import { formatPhone } from "@/lib/phone";
import { requireTeacher } from "@/server/auth/current";
import { getOpenLead } from "@/server/students/learners";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.learners.form");
  return { title: t("newTitle") };
}

export default async function NewLearnerPage({
  searchParams,
}: PageProps<"/[locale]/admin/students/new">) {
  const t = await getTranslations("Admin.learners.form");
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <BackLink href="/admin/students" />
      <h1 className="text-4xl sm:text-5xl">{t("newTitle")}</h1>
      <Suspense fallback={<FormSkeleton />}>
        <NewLearner searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

/** With `?lead=<id>`, the form starts from that free-session booking. */
async function NewLearner({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { teacherId } = await requireTeacher();
  const [t, { lead: leadParam }] = await Promise.all([
    getTranslations("Admin.learners.form"),
    searchParams,
  ]);
  const leadId = z.uuid().safeParse(leadParam);
  const lead = leadId.success ? await getOpenLead(teacherId, leadId.data) : null;
  const names = lead ? splitBookingName(lead.name) : null;

  return (
    <>
      {lead && (
        <p className="rounded-2xl border border-sand bg-[#fdf3dc] px-4 py-3 text-[#4d3700]">
          {t("fromLead", { name: lead.name })}
        </p>
      )}
      <LearnerForm
        mode="create"
        leadId={lead?.id}
        defaults={{
          fullNameFa: names?.fullNameFa ?? "",
          fullNameEn: names?.fullNameEn ?? "",
          phone: lead ? formatPhone(lead.phone) : "",
          email: "",
          messengerHandle: "",
          notes: lead?.notes ?? "",
        }}
      />
    </>
  );
}
