"use client";

import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";

export function LanguageSwitcher() {
  const t = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [isPending, startTransition] = useTransition();
  const next = locale === "fa" ? "en" : "fa";

  return (
    <button
      type="button"
      lang={next}
      aria-label={t("switchToLabel")}
      disabled={isPending}
      onClick={() =>
        startTransition(() => {
          // The next-intl router updates the NEXT_LOCALE cookie, so the choice is remembered.
          // @ts-expect-error -- params always match the current pathname
          router.replace({ pathname, params }, { locale: next });
        })
      }
      className="inline-flex min-h-touch items-center rounded-pill border border-mist bg-white px-4 text-sm font-semibold text-ocean transition hover:border-whale disabled:opacity-60"
    >
      {t("switchTo")}
    </button>
  );
}
