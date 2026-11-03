import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { PasswordForm } from "@/components/student/password-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Student.settings");
  return { title: t("title") };
}

export default async function SettingsPage() {
  const t = await getTranslations("Student.settings");
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-4xl sm:text-5xl">{t("title")}</h1>
      <section
        aria-labelledby="language"
        className="space-y-3 rounded-card border border-hairline bg-white p-5"
      >
        <h2 id="language" className="font-sans text-lg font-extrabold normal-case tracking-normal">
          {t("language")}
        </h2>
        <LanguageSwitcher />
        <p className="text-sm">{t("languageNote")}</p>
      </section>
      <PasswordForm />
    </div>
  );
}
