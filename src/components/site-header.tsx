import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "./language-switcher";
import { Logo } from "./logo";

/** Public header. Auth pages hide the login button (the user is already there). */
export function SiteHeader({ showLogin = true }: { showLogin?: boolean }) {
  const t = useTranslations("Common");
  return (
    <header className="sticky top-0 z-30 border-b border-mist bg-surface/90 backdrop-blur">
      <nav
        aria-label={t("primaryNav")}
        className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2"
      >
        <Link href="/" className="inline-flex min-h-touch items-center rounded-pill">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          {showLogin && (
            <Link
              href="/login"
              className="inline-flex min-h-touch items-center rounded-pill bg-ocean px-5 text-sm font-bold text-white hover:bg-deep"
            >
              {t("login")}
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
