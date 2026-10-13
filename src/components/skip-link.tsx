import { useTranslations } from "next-intl";

/** First focusable element on every page; every page renders `<main id="main">`. */
export function SkipLink() {
  const t = useTranslations("Common");
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-pill focus:bg-ocean focus:px-5 focus:py-3 focus:font-bold focus:text-white"
    >
      {t("skipToContent")}
    </a>
  );
}
