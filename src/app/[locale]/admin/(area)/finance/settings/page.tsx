import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { SettingsForm } from "@/components/admin/finance/forms";
import { BackLink } from "@/components/admin/learners/back-link";
import { db } from "@/db";
import { requireTeacher } from "@/server/auth/current";
import { getSettings } from "@/server/billing/settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.finance.settings");
  return { title: t("title") };
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-card bg-mist" />}
    >
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  const { teacherId } = await requireTeacher();
  const [t, settings] = await Promise.all([
    getTranslations("Admin.finance.settings"),
    getSettings(db, teacherId),
  ]);
  return (
    <div className="max-w-2xl space-y-5">
      <BackLink href="/admin/finance" label={t("back")} />
      <header>
        <h1 className="text-4xl sm:text-5xl">{t("title")}</h1>
        <p className="mt-1">{t("lead")}</p>
      </header>
      <SettingsForm settings={settings} />
    </div>
  );
}
