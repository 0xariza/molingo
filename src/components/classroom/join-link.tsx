"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { roomWindow, type RoomRole } from "@/lib/room-window";

/**
 * The way into a room: shows itself when the room opens and hides when it closes, with no
 * refresh, and opens the room in its own window. `open` is the server's answer for first paint.
 */
export function JoinLink({
  href,
  role,
  startsAt,
  endsAt,
  open,
  className,
  children,
}: {
  href: string;
  role: RoomRole;
  startsAt: Date;
  endsAt: Date;
  open: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [isOpen, setOpen] = useState(open);
  const from = startsAt.getTime();
  const to = endsAt.getTime();

  useEffect(() => {
    const w = roomWindow(role, { startsAt: new Date(from), endsAt: new Date(to) });
    const tick = () => {
      const now = Date.now();
      setOpen(now >= w.opensAt.getTime() && now <= w.closesAt.getTime());
      const next = [w.opensAt, w.closesAt].map((d) => d.getTime() - now).find((ms) => ms > 0);
      // setTimeout overflows past ~24 days; re-check daily until then.
      if (next !== undefined) timer = setTimeout(tick, Math.min(next + 500, 86_400_000));
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    tick();
    return () => clearTimeout(timer);
  }, [role, from, to]);

  if (!isOpen) return null;
  return (
    <Link
      href={href}
      target="_blank"
      className={className}
      onClick={(e) => {
        e.preventDefault();
        const { availWidth: w, availHeight: h } = window.screen;
        if (!window.open(e.currentTarget.href, "_blank", `popup,width=${w},height=${h}`))
          window.location.assign(e.currentTarget.href);
      }}
    >
      {children}
    </Link>
  );
}
