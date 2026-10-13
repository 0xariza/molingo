"use client";

import { ChatsCircle, House, type Icon } from "@phosphor-icons/react";
import { Link, usePathname } from "@/i18n/navigation";

/** Icons by name: server layouts can't pass components to this client component. */
const ICONS = { home: House, freeSessions: ChatsCircle } satisfies Record<string, Icon>;

export type AreaNavItem = {
  href: "/admin" | "/admin/level-checks" | "/app";
  label: string;
  icon: keyof typeof ICONS;
};

type Props = {
  items: AreaNavItem[];
  label: string;
  /** `side`: the desktop sidebar list. `bar`: the phone tab bar. */
  variant: "side" | "bar";
};

/** The area's sections; the current one is highlighted (exact match, or a sub-page of it). */
export function AreaNav({ items, label, variant }: Props) {
  const pathname = usePathname();
  const current = (href: string) =>
    pathname === href || (href !== items[0]?.href && pathname.startsWith(`${href}/`));

  if (variant === "bar") {
    return (
      <nav
        aria-label={label}
        className="fixed inset-x-0 bottom-0 z-30 grid auto-cols-fr grid-flow-col gap-1 bg-ocean px-2 pt-2 pb-safe lg:hidden"
      >
        {items.map(({ href, label, icon }) => {
          const Icon = ICONS[icon];
          const active = current(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-13 flex-col items-center justify-center gap-0.5 rounded-2xl text-xs font-bold ${
                active ? "bg-whale/15 text-whale" : "text-mist/70 hover:text-white"
              }`}
            >
              <Icon aria-hidden size={22} weight={active ? "fill" : "regular"} />
              {label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label={label} className="flex flex-col gap-1">
      {items.map(({ href, label, icon }) => {
        const Icon = ICONS[icon];
        const active = current(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-12 items-center gap-3 rounded-2xl px-4 transition ${
              active
                ? "bg-whale font-extrabold text-ocean"
                : "text-mist hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icon aria-hidden size={20} weight={active ? "fill" : "regular"} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
