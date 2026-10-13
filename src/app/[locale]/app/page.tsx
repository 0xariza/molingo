import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireStudent } from "@/server/auth/current";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Student");
  return { title: t("title") };
}

export default async function StudentHome() {
  const [user, t] = await Promise.all([requireStudent(), getTranslations("Student")]);
  return (
    <section className="rounded-card bg-white p-6 sm:p-10">
      <h1 className="text-4xl">{t("greeting", { name: user.displayName })}</h1>
      <p className="mt-3">{t("placeholder")}</p>
    </section>
  );
}
