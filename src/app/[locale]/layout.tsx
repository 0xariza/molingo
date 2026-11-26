import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { ServiceWorker } from "@/components/service-worker";
import { SkipLink } from "@/components/skip-link";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { localeDirection, routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/site";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  return {
    title: { default: t("title"), template: `%s · Hoopo` },
    description: t("description"),
    metadataBase: new URL(siteUrl),
    icons: { apple: "/apple-icon.png" },
    appleWebApp: { capable: true, title: "Hoopo", statusBarStyle: "black-translucent" },
  };
}

export const viewport: Viewport = {
  themeColor: "#1B2540",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function LocaleLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) notFound();

  return (
    <html lang={locale} dir={localeDirection[locale]}>
      <head>
        <link
          rel="preload"
          href={
            locale === "fa"
              ? "/fonts/vazirmatn-arabic-wght-normal.woff2"
              : "/fonts/lexend-latin-wght-normal.woff2"
          }
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="flex min-h-dvh flex-col">
        <NextIntlClientProvider>
          <SkipLink />
          <ServiceWorker />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
