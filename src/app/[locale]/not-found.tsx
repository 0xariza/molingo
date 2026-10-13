import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  const t = useTranslations("NotFound");
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-20 text-center">
        <h1 className="text-4xl">{t("title")}</h1>
        <p className="mt-4">{t("body")}</p>
        <Link
          href="/"
          className="mt-8 inline-flex min-h-touch items-center rounded-pill bg-brand px-6 font-bold text-white"
        >
          {t("back")}
        </Link>
      </main>
    </>
  );
}
