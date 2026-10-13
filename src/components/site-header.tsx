import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "./language-switcher";
import { Logo } from "./logo";
import { buttonClass } from "./ui/button";

type Props = {
  /** Auth pages hide the login button (the user is already there). */
  showLogin?: boolean;
  /** `ocean` blends into the landing page's deep-blue hero. */
  tone?: "light" | "ocean";
  /** In-page links (landing sections), shown from tablet width up. */
  children?: ReactNode;
};

export function SiteHeader({ showLogin = true, tone = "light", children }: Props) {
  const t = useTranslations("Common");
  const ocean = tone === "ocean";
  return (
    <header
      className={`sticky top-0 z-30 backdrop-blur ${ocean ? "bg-ocean" : "border-b border-mist bg-surface/90"}`}
    >
      <nav
        aria-label={t("primaryNav")}
        className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:py-4"
      >
        <Link href="/" className="inline-flex min-h-touch items-center rounded-pill">
          <Logo variant={ocean ? "dark" : "light"} className="text-xl sm:text-[1.75rem]" />
        </Link>
        {children && (
          <div className="hidden items-center gap-7 text-sm font-semibold text-mist lg:flex">
            {children}
          </div>
        )}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <LanguageSwitcher tone={ocean ? "dark" : "light"} />
          {showLogin && (
            <Link
              href="/login"
              className={buttonClass(
                ocean ? "ghostLight" : "primary",
                "min-h-touch whitespace-nowrap px-4 text-sm sm:px-5",
              )}
            >
              {t("login")}
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
