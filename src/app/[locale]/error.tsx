"use client";

import { useTranslations } from "next-intl";

/** Localized fallback for unexpected server or render errors. Details stay in the server log. */
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("Error");
  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-20 text-center"
    >
      <h1 className="text-4xl">{t("title")}</h1>
      <p className="mt-4">{t("body")}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-8 inline-flex min-h-touch items-center rounded-pill bg-brand px-6 font-bold text-white"
      >
        {t("retry")}
      </button>
    </main>
  );
}
