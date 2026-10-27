import { CheckCircle, ClockCountdown, Users } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { StatCard } from "@/components/area/stat-card";
import { AddTeacher } from "@/components/owner/add-teacher";
import { NewTeacherLink } from "@/components/owner/new-teacher-link";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatNumber } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { requireOwner } from "@/server/auth/current";
import { setTeacherActiveAction } from "@/server/teachers/actions";
import { listTeacherLeads } from "@/server/funnel/teacher-leads";
import { listTeachers } from "@/server/teachers/teachers";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Owner");
  return { title: t("title") };
}

export default function OwnerPage() {
  return (
    <Suspense
      fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-card bg-mist" />}
    >
      <Teachers />
    </Suspense>
  );
}

const STATUS_STYLE = {
  active: "bg-[#e7f5ee] text-[#1f7a4d]",
  pending: "bg-cinnamon-soft text-cinnamon-ink",
  paused: "bg-mist text-body",
} as const;

async function Teachers() {
  await requireOwner();
  const [t, locale, teachers, leads] = await Promise.all([
    getTranslations("Owner"),
    getLocale() as Promise<Locale>,
    listTeachers(),
    listTeacherLeads(),
  ]);
  const n = (v: number) => formatNumber(v, locale);
  const host = new URL(process.env.APP_URL ?? "https://hoopo.ir").host;
  const count = (s: string) => teachers.filter((x) => x.status === s).length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-4xl">{t("title")}</h1>
        <p className="mt-1">{t("lead")}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={CheckCircle}
          tone="green"
          label={t("stats.active")}
          value={n(count("active"))}
        />
        <StatCard
          icon={ClockCountdown}
          tone="sand"
          label={t("stats.pending")}
          value={n(count("pending"))}
        />
        <StatCard
          icon={Users}
          tone="blue"
          label={t("stats.learners")}
          value={n(teachers.reduce((sum, x) => sum + x.learners, 0))}
        />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_380px]">
        <ul className="space-y-3">
          {teachers.length === 0 && <li className="rounded-card bg-white p-6">{t("empty")}</li>}
          {teachers.map((x) => (
            <li
              key={x.id}
              className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-card border border-hairline bg-white p-5"
            >
              <div className="min-w-48 flex-1">
                <p className="font-bold text-ocean">{x.brandName}</p>
                <p className="text-sm">
                  {locale === "fa" ? x.nameFa : x.nameEn} ·{" "}
                  <bdi dir="ltr">{formatPhone(x.phone)}</bdi>
                </p>
                <a
                  href={`/${x.slug}`}
                  target="_blank"
                  rel="noopener"
                  dir="ltr"
                  className="text-sm text-brand underline"
                >
                  {host}/{x.slug}
                </a>
              </div>
              <p className="text-sm">{t("learners", { count: x.learners })}</p>
              <span
                className={`rounded-pill px-3 py-0.5 text-sm font-bold ${STATUS_STYLE[x.status]}`}
              >
                {t(`status.${x.status}`)}
              </span>
              <div className="flex flex-wrap gap-2">
                {x.status === "pending" && <NewTeacherLink id={x.id} phone={x.phone} />}
                <form action={setTeacherActiveAction}>
                  <input type="hidden" name="id" value={x.id} />
                  <input type="hidden" name="active" value={x.status === "paused" ? "1" : "0"} />
                  <button
                    type="submit"
                    className="min-h-touch rounded-[14px] border border-line px-4 font-bold text-ocean hover:border-ocean"
                  >
                    {x.status === "paused" ? t("resume") : t("pause")}
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
        <AddTeacher host={host} />
      </div>

      <section aria-labelledby="leads-title" className="space-y-3">
        <h2 id="leads-title" className="font-sans text-xl font-bold tracking-normal normal-case">
          {t("leads.title")}
        </h2>
        {leads.length === 0 ? (
          <p className="rounded-card border border-hairline bg-white p-5">{t("leads.empty")}</p>
        ) : (
          <ul className="divide-y divide-hairline rounded-card border border-hairline bg-white">
            {leads.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-3.5">
                <b className="min-w-40 flex-1 text-ocean">{l.name}</b>
                <a href={`tel:${l.phone}`} dir="ltr" className="font-bold text-brand">
                  {formatPhone(l.phone)}
                </a>
                <span className="text-sm">{t("leads.learners", { count: l.learners })}</span>
                <span className="text-sm">{formatDate(l.createdAt, locale, { year: false })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
