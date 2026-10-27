"use client";

import type { TrackReferenceOrPlaceholder } from "@livekit/components-react";
import { Maximize, Minimize, Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { clampPan, clampZoom } from "@/lib/video-grid";
import { Tile } from "./tile";

const STEP = 0.5;

/**
 * A shared screen you can zoom (buttons, or pinch on a phone), drag around once zoomed, and open
 * full screen. Zoom is yours alone: nobody else's view changes.
 */
export function ShareView({ trackRef }: { trackRef: TrackReferenceOrPlaceholder }) {
  const t = useTranslations("Classroom.stage");
  const box = useRef<HTMLDivElement>(null);
  const [zoom, setZoomState] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [full, setFull] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  const size = () => ({
    width: box.current?.clientWidth ?? 0,
    height: box.current?.clientHeight ?? 0,
  });

  const setZoom = (z: number) => {
    const next = clampZoom(z);
    setZoomState(next);
    setPan((p) => clampPan(p, next, size()));
  };

  useEffect(() => {
    const on = () => setFull(document.fullscreenElement === box.current);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  const button =
    "grid size-10 place-items-center rounded-full text-room-ink hover:bg-room-line disabled:opacity-40";
  return (
    <div
      ref={box}
      className={`relative size-full touch-none overflow-hidden rounded-[22px] bg-room ${zoom > 1 ? "cursor-grab active:cursor-grabbing" : ""}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }}
      onPointerMove={(e) => {
        const prev = pointers.current.get(e.pointerId);
        if (!prev) return;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const [a, b] = [...pointers.current.values()];
        if (b) {
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          pinch.current ??= { dist, zoom };
          setZoom((pinch.current.zoom * dist) / pinch.current.dist);
        } else if (zoom > 1) {
          setPan((p) =>
            clampPan({ x: p.x + e.clientX - prev.x, y: p.y + e.clientY - prev.y }, zoom, size()),
          );
        }
      }}
      onPointerUp={(e) => {
        pointers.current.delete(e.pointerId);
        pinch.current = null;
      }}
      onPointerCancel={(e) => {
        pointers.current.delete(e.pointerId);
        pinch.current = null;
      }}
    >
      <Tile
        trackRef={trackRef}
        videoStyle={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
      />
      <div
        role="toolbar"
        aria-label={t("zoom")}
        onPointerDown={(e) => e.stopPropagation()}
        // Touch screens pinch instead; on a phone the bar would cover the name tag and your own video.
        className="absolute inset-x-0 bottom-3 mx-auto flex w-fit items-center gap-1 rounded-pill border border-room-line bg-room-card/95 p-1 [@media(pointer:coarse)]:hidden"
      >
        <button
          type="button"
          aria-label={t("zoomOut")}
          title={t("zoomOut")}
          disabled={zoom <= 1}
          onClick={() => setZoom(zoom - STEP)}
          className={button}
        >
          <Minus aria-hidden size={20} />
        </button>
        <button
          type="button"
          aria-label={t("zoomReset")}
          title={t("zoomReset")}
          onClick={() => setZoom(1)}
          className="h-10 min-w-16 rounded-full px-2 text-sm font-bold tabular-nums text-room-ink hover:bg-room-line"
        >
          {t("zoomLevel", { level: zoom })}
        </button>
        <button
          type="button"
          aria-label={t("zoomIn")}
          title={t("zoomIn")}
          disabled={zoom >= clampZoom(Infinity)}
          onClick={() => setZoom(zoom + STEP)}
          className={button}
        >
          <Plus aria-hidden size={20} />
        </button>
        {/* iPhones can't put a page element in full screen; the button only shows where it works. */}
        {document.fullscreenEnabled && (
          <>
            <span aria-hidden="true" className="mx-1 h-6 w-px bg-room-line" />
            <button
              type="button"
              aria-label={full ? t("exitFullscreen") : t("fullscreen")}
              title={full ? t("exitFullscreen") : t("fullscreen")}
              onClick={() =>
                full ? document.exitFullscreen() : box.current?.requestFullscreen().catch(() => {})
              }
              className={button}
            >
              {full ? <Minimize aria-hidden size={20} /> : <Maximize aria-hidden size={20} />}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
