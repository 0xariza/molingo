import { SignOut } from "@phosphor-icons/react/dist/ssr";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { logoutAction } from "@/server/auth/actions";
import { AreaNav, type AreaNavItem } from "./area-nav";
import { AccountMenu } from "./account-menu";
import { NotificationBell } from "./notification-bell";
import { LanguageSwitcher } from "./language-switcher";
import { Logo } from "./logo";

type Props = {
  home: "/admin" | "/app" | "/owner";
  items: AreaNavItem[];
  user: { name: string; role: string };
  /** Learners get an account menu (profile, settings, log out) in place of the language switch and log-out button. */
  account?: { phone: string };
  children: ReactNode;
};

/**
 * Frame of the logged-in areas (the owner's, a teacher's and the students'), as on the Owner design
 * board: a navy sidebar and a plain light page on desktop; a slim navy header and a tab bar at
 * the bottom on phones.
 */
export function AreaShell({ home, items, user, account, children }: Props) {
  const t = useTranslations("Common");
  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 lg:gap-6 lg:px-6 lg:pb-6 lg:pt-10 xl:px-8 xl:pb-8 xl:pt-12">
      <aside className="sticky top-10 hidden h-[calc(100dvh-4rem)] xl:top-12 xl:h-[calc(100dvh-5rem)] w-68 shrink-0 self-start flex-col gap-8 rounded-[28px] bg-ocean px-5 py-6 shadow-[0_12px_40px_rgba(7,30,54,.18)] lg:flex">
        <Link href={home} className="inline-flex min-h-touch items-center self-start rounded-pill">
          <Logo variant="dark" className="text-2xl" />
        </Link>
        <AreaNav items={items} label={t("areaNav")} variant="side" />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-ocean lg:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-8">
            <Link href={home} className="inline-flex min-h-touch items-center rounded-pill">
              <Logo variant="dark" className="text-xl" />
            </Link>
            {account ? (
              <AccountMenu
                variant="avatar"
                name={user.name}
                role={user.role}
                phone={account.phone}
              />
            ) : (
              <div className="flex items-center gap-1.5">
                <LanguageSwitcher tone="dark" />
                <LogoutIconButton label={t("logout")} />
              </div>
            )}
          </div>
        </header>
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col lg:px-6 xl:px-12">
          <div className="hidden justify-end pb-4 pt-2 lg:flex">
            <div className="flex items-center gap-3">
              <NotificationBell
                items={items
                  .filter((i) => i.badge)
                  .map((i) => ({ href: i.href, label: i.label, badge: i.badge! }))}
              />
              {account ? (
                <AccountMenu
                  variant="top"
                  name={user.name}
                  role={user.role}
                  phone={account.phone}
                />
              ) : (
                <>
                  <LanguageSwitcher tone="light" />
                  <div className="flex items-center gap-2.5 rounded-pill border border-hairline bg-white p-1 pe-1.5 shadow-[0_6px_20px_rgba(7,30,54,.10)]">
                    <span
                      aria-hidden="true"
                      className="grid size-10 shrink-0 place-items-center rounded-full bg-cinnamon font-bold text-ocean"
                    >
                      {user.name.slice(0, 1)}
                    </span>
                    <span className="leading-tight">
                      <span className="block font-bold text-ocean">{user.name}</span>
                      <span className="block text-xs text-body">{user.role}</span>
                    </span>
                    <LogoutIconButton label={t("logout")} tone="light" />
                  </div>
                </>
              )}
            </div>
          </div>
          <main id="main" className="w-full flex-1 px-4 pt-6 pb-28 sm:px-8 lg:px-0 lg:pt-0 lg:pb-8">
            {children}
          </main>
        </div>
      </div>

      {items.length > 1 && <AreaNav items={items} label={t("areaNav")} variant="bar" />}
    </div>
  );
}

function LogoutIconButton({ label, tone = "dark" }: { label: string; tone?: "dark" | "light" }) {
  const locale = useLocale();
  return (
    <form action={logoutAction}>
      <input type="hidden" name="locale" value={locale} />
      <button
        type="submit"
        aria-label={label}
        title={label}
        className={`grid size-10 place-items-center rounded-full transition ${tone === "dark" ? "text-whale hover:bg-white/10 hover:text-white" : "text-body hover:bg-surface hover:text-ocean"}`}
      >
        <SignOut aria-hidden size={20} className="icon-directional" />
      </button>
    </form>
  );
}

export function AreaSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="mx-auto flex w-full max-w-[1440px] flex-1 lg:gap-6 lg:px-6 lg:pb-6 lg:pt-10 xl:px-8 xl:pb-8 xl:pt-12"
    >
      <div className="hidden h-[calc(100dvh-4rem)] w-68 xl:h-[calc(100dvh-5rem)] shrink-0 rounded-[28px] bg-ocean lg:block" />
      <div className="flex-1">
        <div className="h-16 bg-ocean lg:hidden" />
        <div className="mx-auto max-w-6xl animate-pulse space-y-4 px-4 py-8 sm:px-8">
          <div className="h-10 w-1/2 rounded-full bg-mist" />
          <div className="h-32 w-full rounded-card bg-mist" />
        </div>
      </div>
    </div>
  );
}
