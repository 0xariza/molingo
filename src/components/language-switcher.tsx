"use client";

import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { Suspense, useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { saveLocalePreference } from "@/server/auth/actions";

const buttonClass =
  "inline-flex min-h-touch items-center rounded-pill border border-mist bg-white px-4 text-sm font-semibold text-ocean transition hover:border-whale disabled:opacity-60";

/** Reads the current URL, so it sits behind Suspense (dynamic routes resolve the path at request time). */
export function LanguageSwitcher() {
  return (
    <Suspense fallback={<SwitcherButton disabled />}>
      <ActiveSwitcher />
    </Suspense>
  );
}

function SwitcherButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const t = useTranslations("Common");
  const next = useLocale() === "fa" ? "en" : "fa";
  return (
    <button
      type="button"
      lang={next}
      aria-label={t("switchToLabel")}
      className={buttonClass}
      {...props}
    >
      {t("switchTo")}
    </button>
  );
}

function ActiveSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [isPending, startTransition] = useTransition();
  const next = locale === "fa" ? "en" : "fa";

  return (
    <SwitcherButton
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          // Also stored on the account when logged in (no-op for visitors).
          await saveLocalePreference(next);
          // The next-intl router updates the NEXT_LOCALE cookie, so the choice is remembered.
          // @ts-expect-error -- params always match the current pathname
          router.replace({ pathname, params }, { locale: next });
        })
      }
    />
  );
}
