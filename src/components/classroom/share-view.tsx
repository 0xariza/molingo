"use client";

import type { TrackReferenceOrPlaceholder } from "@livekit/components-react";
import { Maximize, Minimize, Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { clampPan, clampZoom } from "@/lib/video-grid";
import { useBoxSize } from "./hooks";
import { Tile } from "./tile";

const STEP = 0.5;

/**
 * A shared screen you can zoom (buttons, or pinch on a phone), drag around once zoomed, and open
 * full screen. Zoom is yours alone: nobody else's view changes.
 */
export function ShareView({ trackRef }: { trackRef: TrackReferenceOrPlaceholder }) {
  const t = useTranslations("Classroom.stage");
  const box = useRef<HTMLDivElement | null>(null);
  const [setBox, boxSize] = useBoxSize<HTMLDivElement>();
  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      box.current = node;
      setBox(node);
    },
    [setBox],
  );
  // The shared window's own size: it may not match the box, and it changes when it is resized.
  const [video, setVideo] = useState<{ width: number; height: number } | null>(null);
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  const [full, setFull] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  // Clamped when drawn too, so a resize (full screen, a new window size) never shows an empty edge.
  const { zoom } = view;
  const pan = clampPan(view, zoom, boxSize, video);

  const setZoom = (z: number) =>
    setView((v) => {
      const next = clampZoom(z);
      return { zoom: next, ...clampPan(v, next, boxSize, video) };
    });

  useEffect(() => {
    const on = () => setFull(document.fullscreenElement === box.current);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  // Trackpad pinch and Ctrl + wheel zoom; a plain wheel moves a zoomed picture. Not passive, so the
  // page doesn't zoom or scroll underneath.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const on = (e: WheelEvent) => {
      e.preventDefault();
      setView((v) => {
        if (e.ctrlKey || e.metaKey) {
          const zoom = clampZoom(v.zoom * Math.exp(-e.deltaY / 200));
          return { zoom, ...clampPan(v, zoom, boxSize, video) };
        }
        return {
          ...v,
          ...clampPan({ x: v.x - e.deltaX, y: v.y - e.deltaY }, v.zoom, boxSize, video),
        };
      });
    };
    el.addEventListener("wheel", on, { passive: false });
    return () => el.removeEventListener("wheel", on);
  }, [boxSize, video]);

  const button =
    "grid size-10 place-items-center rounded-full text-room-ink hover:bg-room-line disabled:opacity-40";
  return (
    <div
      ref={ref}
      className={`relative size-full touch-none overflow-hidden rounded-[20px] bg-room ${zoom > 1 ? "cursor-grab active:cursor-grabbing" : ""}`}
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
          setView({
            zoom,
            ...clampPan(
              { x: pan.x + e.clientX - prev.x, y: pan.y + e.clientY - prev.y },
              zoom,
              boxSize,
              video,
            ),
          });
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
        onVideoSize={setVideo}
        videoStyle={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
      />
      {trackRef.participant.isLocal && (
        <p className="absolute start-3 top-3 rounded-pill bg-room/75 px-3 py-1.5 text-[13px] font-semibold text-room-ink">
          {t("sharedToAll")}
        </p>
      )}
      <div
        role="toolbar"
        aria-label={t("zoom")}
        onPointerDown={(e) => e.stopPropagation()}
        // Touch screens pinch instead; the bar sits in the top corner so it never covers the shared window's status bar.
        className="absolute end-3 top-3 flex w-fit items-center gap-1 rounded-pill border border-room-line bg-room-card/95 p-1 [@media(pointer:coarse)]:hidden"
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
          onClick={() => setView({ zoom: 1, x: 0, y: 0 })}
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
