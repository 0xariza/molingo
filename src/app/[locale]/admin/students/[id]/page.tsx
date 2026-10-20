import { PencilSimple } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { BackLink } from "@/components/admin/learners/back-link";
import { LearnerClasses } from "@/components/admin/learners/learner-classes";
import { LoginCard } from "@/components/admin/learners/login-card";
import { StatusBadge } from "@/components/admin/learners/status-badge";
import { StatusSwitch } from "@/components/admin/learners/status-switch";
import { buttonClass } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatDate } from "@/lib/format";
import { learnerNames } from "@/lib/names";
import { formatPhone } from "@/lib/phone";
import { requireAdmin } from "@/server/auth/current";
import { getLearner } from "@/server/students/learners";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.learners.profile");
  return { title: t("details") };
}

export default function LearnerPage({ params }: PageProps<"/[locale]/admin/students/[id]">) {
  return (
    <div className="space-y-5">
      <BackLink href="/admin/students" />
      <Suspense
        fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-card bg-mist" />}
      >
        <Profile params={params} />
      </Suspense>
    </div>
  );
}

async function Profile({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const valid = z.uuid().safeParse(id);
  const learner = valid.success ? await getLearner(valid.data) : null;
  if (!learner) notFound();

  const [t, locale] = await Promise.all([
    getTranslations("Admin.learners.profile"),
    getLocale() as Promise<Locale>,
  ]);
  const { primary, secondary } = learnerNames(learner, locale);
  const card = "space-y-4 rounded-[1.75rem] border border-line/40 bg-white p-6";
  const heading = "font-sans text-lg font-extrabold normal-case tracking-normal";
  const details: [string, React.ReactNode][] = [
    [
      t("nameFa"),
      <span key="fa" lang="fa">
        {learner.fullNameFa}
      </span>,
    ],
    [t("nameEn"), learner.fullNameEn ?? "—"],
    [
      t("phone"),
      <a key="phone" href={`tel:${learner.phone}`} dir="ltr" className="text-brand underline">
        {formatPhone(learner.phone)}
      </a>,
    ],
    [t("email"), learner.email ? <span dir="ltr">{learner.email}</span> : "—"],
    [
      t("messengerHandle"),
      learner.messengerHandle ? <span dir="ltr">{learner.messengerHandle}</span> : "—",
    ],
  ];
  if (learner.bookedSessionAt)
    details.push([
      t("cameFrom"),
      t("cameFromSession", { date: formatDate(learner.bookedSessionAt, locale) }),
    ]);

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="grid size-16 shrink-0 place-items-center rounded-full bg-mist text-2xl font-extrabold text-brand"
          >
            {primary.slice(0, 1)}
          </span>
          <div>
            <h1 className="text-3xl sm:text-4xl">{primary}</h1>
            {secondary && <p className="font-bold">{secondary}</p>}
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
              <StatusBadge status={learner.status} />
              {learner.startedAt && (
                <span>{t("since", { date: formatDate(learner.startedAt, locale) })}</span>
              )}
            </div>
          </div>
        </div>
        <Link href={`/admin/students/${learner.id}/edit`} className={buttonClass("ghost")}>
          <PencilSimple aria-hidden size={18} />
          {t("edit")}
        </Link>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <section aria-labelledby="details-title" className={card}>
            <h2 id="details-title" className={heading}>
              {t("details")}
            </h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-3">
              {details.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt>{label}</dt>
                  <dd className="min-w-0 font-bold break-words text-ocean">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <LearnerClasses studentId={learner.id} />
          <section aria-labelledby="notes-title" className={card}>
            <h2 id="notes-title" className={heading}>
              {t("notesTitle")}
            </h2>
            <p className="whitespace-pre-line text-ocean">{learner.notes ?? t("notesEmpty")}</p>
            <p className="text-sm">{t("notesHint")}</p>
          </section>
        </div>
        <div className="space-y-5">
          <LoginCard studentId={learner.id} phone={learner.phone} login={learner.login} />
          <StatusSwitch id={learner.id} status={learner.status} />
        </div>
      </div>
    </>
  );
}
