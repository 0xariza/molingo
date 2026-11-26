"use client";

import {
  BookOpen,
  DotsThree,
  MapTrifold,
  CalendarDots,
  ChalkboardTeacher,
  ClipboardText,
  GraduationCap,
  House,
  IdentificationCard,
  Users,
  Wallet,
  type Icon,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";

/** Icons by name: server layouts can't pass components to this client component. */
const ICONS = {
  home: House,
  schedule: CalendarDots,
  learners: Users,
  classes: ChalkboardTeacher,
  page: IdentificationCard,
  teachers: GraduationCap,
  homework: ClipboardText,
  sources: BookOpen,
  path: MapTrifold,
  finance: Wallet,
} satisfies Record<string, Icon>;

export type AreaNavItem = {
  href:
    | "/admin"
    | "/admin/schedule"
    | "/admin/students"
    | "/admin/classes"
    | "/admin/homework"
    | "/admin/my-page"
    | "/admin/sources"
    | "/admin/finance"
    | "/app"
    | "/app/classes"
    | "/app/schedule"
    | "/app/homework"
    | "/app/path"
    | "/app/bills"
    | "/owner";
  label: string;
  icon: keyof typeof ICONS;
  /** A small count next to the label (e.g. upcoming bookings). */
  badge?: string;
  /** Left out of the phone tab bar (it stays in the sidebar). */
  sideOnly?: boolean;
  /** On phones it sits in the "More" sheet instead of the tab bar (it stays in the sidebar). */
  more?: boolean;
  /** A path whose pages also count as this section (e.g. a page folded into it). */
  also?: string;
};

type Props = {
  items: AreaNavItem[];
  label: string;
  /** `side`: the desktop sidebar list. `bar`: the phone tab bar. */
  variant: "side" | "bar";
  /** The phone bar's overflow button (only used when some item is `more`). */
  moreLabel?: string;
};

/** The area's sections; the current one is highlighted (exact match, or a sub-page of it). */
export function AreaNav({ items, label, variant, moreLabel }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isCurrent = (href: string) =>
    pathname === href || (href !== items[0]?.href && pathname.startsWith(`${href}/`));
  const current = (item: AreaNavItem) =>
    isCurrent(item.href) || (item.also ? isCurrent(item.also) : false);
  const tabs = items.filter((item) => !item.sideOnly && !item.more);
  const overflow = items.filter((item) => item.more);

  // The sheet closes on Escape, a tap outside it, or a tap on one of its links.
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (
        e instanceof KeyboardEvent
          ? e.key === "Escape"
          : !(e.target as Element).closest("[data-more]")
      )
        setOpen(false);
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", close);
    };
  }, [open]);

  if (variant === "bar") {
    return (
      <nav
        aria-label={label}
        className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 grid auto-cols-fr grid-flow-col gap-1 rounded-[28px] bg-ocean p-2 shadow-[0_8px_24px_rgba(7,30,54,.28)] lg:hidden"
      >
        {tabs.map((item) => {
          const { href, label, icon, badge } = item;
          const Icon = ICONS[icon];
          const active = current(item);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-13 flex-col items-center justify-center gap-0.5 rounded-2xl text-xs font-bold ${
                active ? "bg-whale/15 text-whale" : "text-mist/70 hover:text-white"
              }`}
            >
              <Icon aria-hidden size={22} weight={active ? "fill" : "regular"} />
              {label}
              {badge && (
                <span className="absolute end-2 top-1 grid h-4.5 min-w-4.5 place-items-center rounded-pill bg-sand px-1 text-[10px] font-extrabold text-ocean">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
        {overflow.length > 0 && (
          <div data-more className="contents">
            {open && (
              <ul
                id="area-more"
                className="absolute inset-x-0 bottom-[calc(100%+8px)] grid gap-1 rounded-[28px] bg-ocean p-2 shadow-[0_8px_24px_rgba(7,30,54,.28)]"
              >
                {overflow.map((item) => {
                  const Icon = ICONS[item.icon];
                  const active = current(item);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={`flex min-h-12 items-center gap-3 rounded-2xl px-4 font-bold ${
                          active ? "bg-whale/15 text-whale" : "text-mist hover:text-white"
                        }`}
                      >
                        <Icon aria-hidden size={22} weight={active ? "fill" : "regular"} />
                        <span className="flex-1">{item.label}</span>
                        {item.badge && (
                          <span className="grid h-5.5 min-w-5.5 place-items-center rounded-pill bg-sand px-1.5 text-xs font-extrabold text-ocean">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            <button
              type="button"
              aria-expanded={open}
              aria-controls="area-more"
              onClick={() => setOpen((v) => !v)}
              className={`relative flex min-h-13 flex-col items-center justify-center gap-0.5 rounded-2xl text-xs font-bold ${
                open || overflow.some(current)
                  ? "bg-whale/15 text-whale"
                  : "text-mist/70 hover:text-white"
              }`}
            >
              <DotsThree aria-hidden size={22} weight="bold" />
              {moreLabel}
              {overflow.some((item) => item.badge) && (
                <span
                  aria-hidden="true"
                  className="absolute end-4 top-1.5 size-2.5 rounded-pill bg-sand"
                />
              )}
            </button>
          </div>
        )}
      </nav>
    );
  }

  return (
    <nav aria-label={label} className="flex flex-col gap-1">
      {items.map((item) => {
        const { href, label, icon, badge } = item;
        const Icon = ICONS[icon];
        const active = current(item);
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
            <span className="flex-1">{label}</span>
            {badge && (
              <span className="grid h-5.5 min-w-5.5 place-items-center rounded-pill bg-sand px-1.5 text-xs font-extrabold text-ocean">
                {badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
