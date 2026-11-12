"use client";

import { Bell } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";

type Item = { href: string; label: string; badge: string };

/** The top bar's bell: the nav items that carry a count (homework to do, answers to review). */
export function NotificationBell({ items }: { items: Item[] }) {
  const t = useTranslations("Common");
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

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={id}
        aria-label={t("notifications")}
        onClick={() => setOpen((o) => !o)}
        className="relative grid size-12 place-items-center rounded-full border border-hairline bg-white text-ocean shadow-[0_6px_20px_rgba(7,30,54,.10)] hover:border-brand"
      >
        <Bell aria-hidden size={20} />
        {items.length > 0 && (
          <span
            aria-hidden
            className="absolute end-2.5 top-2.5 size-2.5 rounded-full bg-cinnamon ring-2 ring-white"
          />
        )}
      </button>
      {open && (
        <div
          id={id}
          className="absolute end-0 top-[calc(100%+6px)] z-40 w-72 rounded-2xl border border-line/40 bg-white p-1.5 shadow-[0_16px_40px_rgba(7,30,54,.14)]"
        >
          <p className="px-3 py-2 font-bold text-ocean">{t("notifications")}</p>
          {items.length === 0 && <p className="px-3 pb-3 text-sm">{t("noNotifications")}</p>}
          {items.map((i) => (
            <Link
              key={i.href}
              href={i.href as "/app"}
              onClick={() => setOpen(false)}
              className="flex min-h-touch items-center justify-between gap-3 rounded-xl px-3 font-bold text-ocean hover:bg-surface"
            >
              {i.label}
              <span className="grid min-w-6 place-items-center rounded-full bg-cinnamon px-1.5 text-sm text-ocean">
                {i.badge}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
