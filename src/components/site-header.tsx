import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "./language-switcher";
import { Logo } from "./logo";

export function SiteHeader() {
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
        </div>
      </nav>
    </header>
  );
}
