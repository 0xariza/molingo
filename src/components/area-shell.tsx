import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "./language-switcher";
import { LogoutButton } from "./logout-button";
import { Logo } from "./logo";

/** Header + main for the logged-in areas (admin and student). Navigation comes in later milestones. */
export function AreaShell({ home, children }: { home: "/admin" | "/app"; children: ReactNode }) {
  const t = useTranslations("Common");
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-mist bg-surface/90 backdrop-blur">
        <nav
          aria-label={t("primaryNav")}
          className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2"
        >
          <Link href={home} className="inline-flex min-h-touch items-center rounded-pill">
            <Logo />
          </Link>
          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            <LogoutButton />
          </div>
        </nav>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
    </>
  );
}

export function AreaSkeleton() {
  return (
    <div aria-hidden="true" className="mx-auto w-full max-w-6xl animate-pulse space-y-4 px-4 py-8">
      <div className="h-10 w-1/2 rounded-full bg-mist" />
      <div className="h-32 w-full rounded-card bg-mist" />
    </div>
  );
}
