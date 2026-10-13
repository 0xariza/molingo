import { useTranslations } from "next-intl";
import { SiteHeader } from "@/components/site-header";

export default function HomePage() {
  const t = useTranslations("Home");
  const c = useTranslations("Common");
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-12 sm:py-20">
        <section className="rounded-card bg-ocean px-6 py-12 text-mist sm:px-12 sm:py-16">
          <p className="mb-4 text-sm font-semibold text-whale">{t("eyebrow")}</p>
          <h1 className="max-w-2xl text-5xl text-white sm:text-7xl">{t("title")}</h1>
          <p className="mt-6 max-w-xl text-lg">{t("lead")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#"
              className="inline-flex min-h-touch items-center rounded-pill bg-sand px-6 font-bold text-ocean"
            >
              {c("bookLevelCheck")}
            </a>
          </div>
        </section>
        <p className="mt-8 text-center text-sm">{t("comingSoon")}</p>
      </main>
    </>
  );
}
