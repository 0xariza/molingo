import { routing, type Locale } from "@/i18n/routing";

/** The public origin, for canonical URLs, hreflang, the sitemap and Open Graph. */
export const siteUrl = process.env.APP_URL ?? "https://hoopo.ir";

/** Path without the locale, e.g. "" (home) or "/mona". */
export function localeAlternates(locale: Locale, path = "") {
  return {
    canonical: `${siteUrl}/${locale}${path}`,
    languages: {
      ...(Object.fromEntries(routing.locales.map((l) => [l, `${siteUrl}/${l}${path}`])) as Record<
        Locale,
        string
      >),
      "x-default": `${siteUrl}/${routing.defaultLocale}${path}`,
    },
  };
}

/** One 1200×630 share image per language (public/og-<locale>.png). */
export function ogImage(locale: Locale) {
  return { url: `${siteUrl}/og-${locale}.png`, width: 1200, height: 630 };
}

/**
 * The platform home page stays out of search (noindex, not in the sitemap) while it still shows
 * [X]/[Y]/[Z] placeholders (PLAN, M6d). Set to true once they are real.
 */
export const platformHomeReady = false;

/** Open Graph + Twitter fields shared by the public pages. */
export function socialMeta(locale: Locale, path: string, title: string, description: string) {
  return {
    openGraph: {
      type: "website" as const,
      siteName: "Hoopo",
      locale: locale === "fa" ? "fa_IR" : "en_US",
      url: `${siteUrl}/${locale}${path}`,
      title,
      description,
      images: [ogImage(locale)],
    },
    twitter: {
      card: "summary_large_image" as const,
      title,
      description,
      images: [ogImage(locale).url],
    },
  };
}
