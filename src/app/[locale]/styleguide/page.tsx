/* eslint-disable react/jsx-no-literals -- dev-only specimen page shows fixed sample text in both scripts */
import { hasLocale, useTranslations } from "next-intl";
import { notFound } from "next/navigation";
import { use } from "react";
import { Logo } from "@/components/logo";
import { SiteHeader } from "@/components/site-header";
import { routing } from "@/i18n/routing";
import { formatDate, formatTime, formatToman } from "@/lib/format";

// Dev-only page for checking tokens, type and formatting in both directions.
const swatches = [
  ["ocean", "#071E36", "bg-ocean"],
  ["deep", "#0F4C81", "bg-deep"],
  ["brand", "#13609B", "bg-brand"],
  ["whale", "#8EC5E8", "bg-whale"],
  ["mist", "#E3EFF8", "bg-mist"],
  ["surface", "#F3F7FB", "bg-surface"],
  ["body", "#3A5670", "bg-body"],
  ["sand", "#F2C46B", "bg-sand"],
] as const;

const sample = new Date("2026-10-13T14:30:00Z");

export default function StyleguidePage({ params }: PageProps<"/[locale]/styleguide">) {
  if (process.env.NODE_ENV === "production") notFound();
  const { locale } = use(params);
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = useTranslations("Styleguide");

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-4xl space-y-10 px-4 py-10">
        <h1 className="text-5xl">{t("title")}</h1>

        <section className="space-y-4">
          <h2 className="text-3xl">{t("colors")}</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {swatches.map(([name, hex, cls]) => (
              <li key={name} className="overflow-hidden rounded-card border border-mist bg-white">
                <div className={`h-16 ${cls}`} />
                <div dir="ltr" className="px-4 py-2 text-start text-sm">
                  <strong className="text-ocean">{name}</strong> {hex}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-3xl">{t("type")}</h2>
          <div className="flex flex-wrap items-center gap-6 rounded-card bg-white p-6">
            <Logo className="text-4xl" />
            <span className="rounded-card bg-ocean px-4 py-3">
              <Logo variant="dark" className="text-4xl" />
            </span>
          </div>
          <p className="font-heading text-6xl font-bold text-ocean">Speak. Don&apos;t just study.</p>
          <p lang="fa" dir="rtl" className="text-3xl font-extrabold text-ocean [font-family:Vazirmatn]">
            حرف بزن، فقط درس نخوان.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-3xl">{t("buttons")}</h2>
          <div className="flex flex-wrap gap-3">
            <button className="min-h-touch rounded-pill bg-brand px-6 font-bold text-white">{t("primary")}</button>
            <button className="min-h-touch rounded-pill bg-sand px-6 font-bold text-ocean">{t("secondary")}</button>
            <button className="min-h-touch rounded-pill border border-brand px-6 font-bold text-brand">{t("ghost")}</button>
            <button className="inline-flex min-h-touch items-center gap-2 rounded-pill bg-ocean ps-6 pe-4 font-bold text-white">
              {t("next")}
              <svg aria-hidden="true" viewBox="0 0 24 24" className="icon-directional size-5" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-3xl">{t("cards")}</h2>
          <article className="max-w-sm rounded-card bg-white p-6 shadow-sm">
            <span className="rounded-pill bg-mist px-3 py-1 text-sm font-bold text-deep">B1.2</span>
            <h3 className="mt-3 text-2xl">{t("cardTitle")}</h3>
            <p className="mt-1">{t("cardBody")}</p>
            <p className="mt-2 font-semibold text-brand">{t("seatsLeft", { count: 2 })}</p>
          </article>
        </section>

        <section className="space-y-4">
          <h2 className="text-3xl">{t("formatting")}</h2>
          <dl className="grid max-w-md grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-card bg-white p-6">
            <dt>{t("sessionDate")}</dt>
            <dd className="font-semibold text-ocean">{formatDate(sample, locale)}</dd>
            <dt>{t("sessionTime")}</dt>
            <dd className="font-semibold text-ocean">{formatTime(sample, locale)}</dd>
            <dt>{t("price")}</dt>
            <dd className="font-semibold text-ocean">{formatToman(5_000_000, locale)}</dd>
          </dl>
        </section>
      </main>
    </>
  );
}
