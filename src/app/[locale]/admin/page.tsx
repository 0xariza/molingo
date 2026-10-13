import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/server/auth/current";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin");
  return { title: t("title") };
}

export default async function AdminHome() {
  const [user, t] = await Promise.all([requireAdmin(), getTranslations("Admin")]);
  return (
    <section className="rounded-card bg-white p-6 sm:p-10">
      <h1 className="text-4xl">{t("greeting", { name: user.displayName })}</h1>
      <p className="mt-3">{t("placeholder")}</p>
    </section>
  );
}
