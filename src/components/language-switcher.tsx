"use client";

import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { Suspense, useTransition } from "react";
import type { Locale } from "@/i18n/routing";
import { usePathname, useRouter } from "@/i18n/navigation";
import { saveLocalePreference } from "@/server/auth/actions";

type Props = {
  /** `dark` sits on the ocean header and footer. */
  tone?: "light" | "dark";
};

const OPTIONS = [
  { locale: "en", short: "EN", label: "english" },
  { locale: "fa", short: "FA", label: "persian" },
] as const;

/** "EN | FA" toggle. Reads the current URL, so it sits behind Suspense. */
export function LanguageSwitcher({ tone = "light" }: Props) {
  return (
    <Suspense fallback={<Toggle tone={tone} />}>
      <ActiveSwitcher tone={tone} />
    </Suspense>
  );
}

function Toggle({
  tone,
  pending = false,
  onSelect,
}: Props & { pending?: boolean; onSelect?: (locale: Locale) => void }) {
  const t = useTranslations("Common");
  const current = useLocale();
  const dark = tone === "dark";
  return (
    <div
      role="group"
      aria-label={t("language")}
      dir="ltr"
      className={`flex rounded-pill border p-0.5 font-wordmark text-sm font-bold tracking-wider ${dark ? "border-whale/40" : "border-mist bg-white"}`}
    >
      {OPTIONS.map(({ locale, short, label }) => {
        const active = locale === current;
        return (
          <button
            key={locale}
            type="button"
            lang={locale}
            aria-label={t(label)}
            aria-pressed={active}
            disabled={!onSelect || pending}
            onClick={active ? undefined : () => onSelect?.(locale)}
            className={`relative h-8 min-w-9 rounded-pill px-2 transition after:absolute after:inset-x-0 after:-inset-y-1.5 disabled:cursor-default ${
              active
                ? dark
                  ? "cursor-default bg-white text-ocean"
                  : "cursor-default bg-ocean text-white"
                : dark
                  ? "text-whale hover:text-white"
                  : "text-body hover:text-ocean"
            }`}
          >
            {short}
          </button>
        );
      })}
    </div>
  );
}

function ActiveSwitcher({ tone }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [isPending, startTransition] = useTransition();

  return (
    <Toggle
      tone={tone}
      pending={isPending}
      onSelect={(next) =>
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
