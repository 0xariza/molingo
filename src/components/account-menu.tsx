"use client";

import { Gear, IdentificationCard, SignOut } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { logoutAction } from "@/server/auth/actions";

type Props = {
  name: string;
  role: string;
  phone: string;
  /** `avatar`: the phone header's round button. `card`: the sidebar user card. `top`: the desktop top bar. */
  variant: "avatar" | "card" | "top";
};

/** The learner's avatar menu: profile, settings and log out. */
export function AccountMenu({ name, role, phone, variant }: Props) {
  const t = useTranslations("Student.account");
  const locale = useLocale();
  const id = useId();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const avatar = (size: string) => (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full bg-cinnamon font-extrabold leading-none text-ocean ${size}`}
    >
      {name.slice(0, 1)}
    </span>
  );
  const item =
    "flex min-h-11 items-center gap-2.5 rounded-xl px-2 text-sm font-bold text-ocean transition hover:bg-line/15";
  const chip = "grid size-8 shrink-0 place-items-center rounded-lg bg-surface text-ocean";

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        aria-label={variant === "avatar" ? t("open") : undefined}
        onClick={() => setOpen((o) => !o)}
        className={
          variant === "avatar"
            ? "grid size-11 place-items-center rounded-full hover:bg-white/10"
            : variant === "top"
              ? "flex items-center gap-2.5 rounded-pill border border-hairline bg-white p-1 pe-4 text-start shadow-[0_6px_20px_rgba(7,30,54,.10)] hover:border-brand"
              : "flex w-full items-center gap-3 rounded-card bg-white/5 p-3 text-start hover:bg-white/10"
        }
      >
        {avatar("size-10 text-base")}
        {variant === "top" && (
          <span className="leading-tight">
            <span className="block font-bold text-ocean">{name}</span>
            <span className="block text-xs text-body">{role}</span>
          </span>
        )}
        {variant === "card" && (
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate font-bold text-white">{name}</span>
            <span className="block text-sm text-whale">{role}</span>
          </span>
        )}
      </button>
      {open && (
        <div
          id={id}
          role="menu"
          className={`absolute z-40 w-60 rounded-2xl border border-hairline bg-white p-1.5 shadow-[0_20px_50px_rgba(7,30,54,.16)] ${
            variant !== "card"
              ? "end-0 top-[calc(100%+8px)]"
              : "inset-x-0 bottom-[calc(100%+6px)] w-auto"
          }`}
        >
          <div className="flex items-center gap-2.5 px-2 pb-2.5 pt-1.5">
            {avatar("size-10 text-base")}
            <span className="min-w-0 leading-snug">
              <b className="block truncate text-sm text-ocean">{name}</b>
              <span dir="ltr" className="block text-start text-xs">
                {phone}
              </span>
            </span>
          </div>
          <div className="space-y-0.5 border-t border-surface pt-1">
            <Link
              href="/app/profile"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={item}
            >
              <span aria-hidden className={chip}>
                <IdentificationCard size={18} />
              </span>
              {t("profile")}
            </Link>
            <Link
              href="/app/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={item}
            >
              <span aria-hidden className={chip}>
                <Gear size={18} />
              </span>
              {t("settings")}
            </Link>
          </div>
          <form action={logoutAction} className="mt-1 border-t border-surface pt-1">
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" role="menuitem" className={`${item} w-full text-red-700`}>
              <span
                aria-hidden
                className="grid size-8 shrink-0 place-items-center rounded-lg bg-red-50 text-red-700"
              >
                <SignOut size={18} className="icon-directional" />
              </span>
              {t("logout")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
