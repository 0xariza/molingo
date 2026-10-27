"use client";

import { PictureInPicture2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

type Corner = { v: "top" | "bottom"; h: "start" | "end" };

/**
 * Your own video floating over the stage. Drag it anywhere; it glides into the nearest corner.
 * Minimised, it shrinks to a small button in that corner. Dragging moves the element directly,
 * without re-rendering the video on every pointer move.
 */
export function FloatingSelf({
  narrow,
  minimised,
  onRestore,
  children,
}: {
  narrow: boolean;
  minimised: boolean;
  onRestore: () => void;
  children: ReactNode;
}) {
  const t = useTranslations("Classroom.stage");
  const [corner, setCorner] = useState<Corner>({ v: narrow ? "top" : "bottom", h: "end" });
  const box = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const from = useRef<DOMRect | null>(null);

  // After a drop, glide from where it was let go into its corner.
  useLayoutEffect(() => {
    const el = box.current;
    const prev = from.current;
    from.current = null;
    if (!el || !prev || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const now = el.getBoundingClientRect();
    el.animate(
      [
        { transform: `translate(${prev.left - now.left}px, ${prev.top - now.top}px)` },
        { transform: "none" },
      ],
      { duration: 220, easing: "cubic-bezier(.2,.8,.2,1)" },
    );
  }, [corner]);
  const place = `${corner.v === "top" ? "top-3" : "bottom-3"} ${corner.h === "start" ? "start-3" : "end-3"}`;

  if (minimised)
    return (
      <button
        type="button"
        onClick={onRestore}
        className={`absolute z-10 ${place} inline-flex h-10 items-center gap-2 rounded-pill bg-room-raised px-3.5 text-sm font-medium text-room-ink shadow-[0_8px_24px_rgba(0,0,0,.45)] hover:bg-room-line`}
      >
        <PictureInPicture2 aria-hidden size={18} />
        {t("restore")}
      </button>
    );

  return (
    <div
      ref={box}
      role="group"
      aria-label={t("drag")}
      className={`absolute z-10 ${place} touch-none rounded-[14px] shadow-[0_8px_24px_rgba(0,0,0,.45)] ring-2 ring-room ${
        narrow ? "aspect-[3/4] w-24" : "aspect-video w-56"
      } cursor-grab active:cursor-grabbing`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerMove={(e) => {
        if (!start.current) return;
        const { x, y } = start.current;
        e.currentTarget.style.transform = `translate(${e.clientX - x}px, ${e.clientY - y}px)`;
      }}
      onPointerUp={(e) => {
        const el = e.currentTarget;
        const rect = el.getBoundingClientRect();
        const stage = el.offsetParent?.getBoundingClientRect();
        start.current = null;
        el.style.transform = "";
        if (!stage) return;
        from.current = rect;
        const onLeft = rect.left + rect.width / 2 < stage.left + stage.width / 2;
        const rtl = getComputedStyle(el).direction === "rtl";
        setCorner({
          v: rect.top + rect.height / 2 < stage.top + stage.height / 2 ? "top" : "bottom",
          h: onLeft !== rtl ? "start" : "end",
        });
      }}
      onPointerCancel={(e) => {
        start.current = null;
        e.currentTarget.style.transform = "";
      }}
    >
      {children}
    </div>
  );
}
