import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatDate } from "@/lib/format";
import { learnerNames } from "@/lib/names";
import { formatPhone } from "@/lib/phone";
import { requireStudent } from "@/server/auth/current";
import { learnerProfile } from "@/server/students/profile";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Student.profile");
  return { title: t("title") };
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={<div aria-hidden="true" className="h-64 animate-pulse rounded-card bg-mist" />}
    >
      <Profile />
    </Suspense>
  );
}

async function Profile() {
  const user = await requireStudent();
  const profile = await learnerProfile(user.id);
  if (!profile) notFound();
  const [t, locale] = await Promise.all([
    getTranslations("Student.profile"),
    getLocale() as Promise<Locale>,
  ]);
  const name = learnerNames(profile, locale).primary;
  const rows: [string, string][] = [
    [t("nameFa"), profile.fullNameFa],
    [t("nameEn"), profile.fullNameEn ?? t("none")],
    [t("phone"), formatPhone(profile.phone)],
    [t("email"), profile.email ?? t("none")],
    [
      t("teachers", { count: profile.teachers.length }),
      profile.teachers
        .map((x) => (locale === "en" ? x.nameEn : x.nameFa))
        .join(locale === "fa" ? "، " : ", ") || t("none"),
    ],
  ];
  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-4xl sm:text-5xl">{t("title")}</h1>
      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="grid size-14 shrink-0 place-items-center rounded-full bg-cinnamon text-xl font-extrabold text-ocean"
        >
          {name.slice(0, 1)}
        </span>
        <div className="leading-tight">
          <p className="text-lg font-extrabold text-ocean">{name}</p>
          <p className="text-sm">
            {t("since", { date: formatDate(profile.since, locale, { weekday: false }) })}
          </p>
        </div>
      </div>
      <dl className="divide-y divide-mist rounded-card border border-hairline bg-white px-5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-wrap justify-between gap-x-4 py-3.5">
            <dt>{label}</dt>
            <dd dir="auto" className="font-bold text-ocean">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-sm">{t("note")}</p>
      <Link
        href="/app/settings"
        className="inline-flex min-h-touch items-center gap-1 font-bold text-brand hover:underline"
      >
        {t("settings")}
        <CaretRight aria-hidden size={18} className="icon-directional" />
      </Link>
    </div>
  );
}
