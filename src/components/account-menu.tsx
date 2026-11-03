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
  /** `avatar`: the phone header's round button. `card`: the desktop sidebar's user card. */
  variant: "avatar" | "card";
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

  const initial = (
    <span
      aria-hidden="true"
      className="grid size-10 shrink-0 place-items-center rounded-full bg-cinnamon font-bold text-ocean"
    >
      {name.slice(0, 1)}
    </span>
  );
  const item =
    "flex min-h-touch items-center gap-3 rounded-xl px-3 font-bold text-ocean hover:bg-surface";

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
            : "flex w-full items-center gap-3 rounded-card bg-white/5 p-3 text-start hover:bg-white/10"
        }
      >
        {initial}
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
          className={`absolute z-40 w-64 rounded-2xl border border-line/40 bg-white p-1.5 shadow-[0_16px_40px_rgba(7,30,54,.14)] ${
            variant === "avatar"
              ? "end-0 top-[calc(100%+6px)]"
              : "inset-x-0 bottom-[calc(100%+6px)] w-auto"
          }`}
        >
          <div className="px-3 py-2 leading-tight">
            <p className="font-bold text-ocean">{name}</p>
            <p dir="ltr" className="text-sm text-start">
              {phone}
            </p>
          </div>
          <Link href="/app/profile" role="menuitem" onClick={() => setOpen(false)} className={item}>
            <IdentificationCard aria-hidden size={20} />
            {t("profile")}
          </Link>
          <Link
            href="/app/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={item}
          >
            <Gear aria-hidden size={20} />
            <span className="leading-tight">
              <span className="block">{t("settings")}</span>
              <span className="block text-sm font-normal text-body">{t("settingsHint")}</span>
            </span>
          </Link>
          <form action={logoutAction} className="mt-1 border-t border-mist pt-1">
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" role="menuitem" className={`${item} w-full`}>
              <SignOut aria-hidden size={20} className="icon-directional" />
              {t("logout")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
