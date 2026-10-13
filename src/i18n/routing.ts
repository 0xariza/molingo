import { defineRouting } from "next-intl/routing";

export const locales = ["fa", "en"] as const;
export type Locale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: "fa",
  localePrefix: "always",
  // Ignore Accept-Language: Persian is the default unless the user picked English.
  localeDetection: false,
  localeCookie: { name: "NEXT_LOCALE", maxAge: 60 * 60 * 24 * 365 },
});

export const localeDirection: Record<Locale, "rtl" | "ltr"> = {
  fa: "rtl",
  en: "ltr",
};
