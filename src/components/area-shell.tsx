import { SignOut } from "@phosphor-icons/react/dist/ssr";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { logoutAction } from "@/server/auth/actions";
import { AreaNav, type AreaNavItem } from "./area-nav";
import { LanguageSwitcher } from "./language-switcher";
import { Logo } from "./logo";
import { WaveEdge } from "./wave-edge";

type Props = {
  home: "/admin" | "/app";
  items: AreaNavItem[];
  user: { name: string; role: string };
  children: ReactNode;
};

/**
 * Frame of the logged-in areas (Mona's and the students'): a navy sidebar on desktop, a slim navy
 * header ending in the brand wave, and a tab bar at the bottom on phones.
 */
export function AreaShell({ home, items, user, children }: Props) {
  const t = useTranslations("Common");
  return (
    <div className="flex flex-1">
      <aside className="sticky top-0 hidden h-dvh w-68 shrink-0 flex-col gap-8 bg-ocean px-5 py-6 lg:flex">
        <Link href={home} className="inline-flex min-h-touch items-center self-start rounded-pill">
          <Logo variant="dark" className="text-2xl" />
        </Link>
        <AreaNav items={items} label={t("areaNav")} variant="side" />
        <div className="mt-auto flex items-center gap-3 rounded-2xl bg-white/5 p-3">
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-sand font-extrabold text-ocean"
          >
            {user.name.slice(0, 1)}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate font-bold text-white">{user.name}</p>
            <p className="text-sm text-whale">{user.role}</p>
          </div>
          <LogoutIconButton label={t("logout")} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-ocean">
          <div className="flex items-center justify-between gap-3 px-4 pt-3 sm:px-8 lg:justify-end lg:pt-5">
            <Link
              href={home}
              className="inline-flex min-h-touch items-center rounded-pill lg:hidden"
            >
              <Logo variant="dark" className="text-xl" />
            </Link>
            <div className="flex items-center gap-1.5">
              <LanguageSwitcher tone="dark" />
              <span className="lg:hidden">
                <LogoutIconButton label={t("logout")} />
              </span>
            </div>
          </div>
          <WaveEdge className="h-10 sm:h-14" />
        </header>
        <main
          id="main"
          className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 sm:px-8 lg:pb-12"
        >
          {children}
        </main>
      </div>

      {items.length > 1 && <AreaNav items={items} label={t("areaNav")} variant="bar" />}
    </div>
  );
}

function LogoutIconButton({ label }: { label: string }) {
  const locale = useLocale();
  return (
    <form action={logoutAction}>
      <input type="hidden" name="locale" value={locale} />
      <button
        type="submit"
        aria-label={label}
        title={label}
        className="grid size-11 place-items-center rounded-xl text-whale transition hover:bg-white/10 hover:text-white"
      >
        <SignOut aria-hidden size={20} className="icon-directional" />
      </button>
    </form>
  );
}

export function AreaSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-1">
      <div className="hidden w-68 shrink-0 bg-ocean lg:block" />
      <div className="flex-1">
        <div className="h-20 bg-ocean" />
        <div className="mx-auto max-w-6xl animate-pulse space-y-4 px-4 py-8 sm:px-8">
          <div className="h-10 w-1/2 rounded-full bg-mist" />
          <div className="h-32 w-full rounded-card bg-mist" />
        </div>
      </div>
    </div>
  );
}
