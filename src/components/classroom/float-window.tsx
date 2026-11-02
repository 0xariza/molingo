"use client";

import { useTrackToggle, type TrackReferenceOrPlaceholder } from "@livekit/components-react";
import { Track } from "livekit-client";
import { Maximize2, Mic, MicOff, Minimize2, PhoneOff, Video, VideoOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Tile } from "./tile";

declare global {
  interface Window {
    documentPictureInPicture?: {
      requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
    };
  }
}

const BIG = { width: 340, height: 340 };
const SMALL = { width: 176, height: 100 };

/** Chrome and Edge on desktop only; elsewhere the class simply stays in its tab. */
export const floatSupported = () =>
  typeof window !== "undefined" && "documentPictureInPicture" in window;

/**
 * The always-on-top class window (Document Picture-in-Picture). Opens by itself when `sharing`
 * starts and `auto` allows it, and closes when sharing stops. `open` is for a click.
 */
export function useFloatWindow(sharing: boolean, auto: boolean) {
  const [win, setWin] = useState<Window | null>(null);
  const current = useRef<Window | null>(null);
  const open = useCallback(async () => {
    if (!window.documentPictureInPicture || current.current) return;
    const w = await window.documentPictureInPicture.requestWindow(BIG);
    // Same look as the room: the page's own styles, language and direction.
    for (const node of document.head.querySelectorAll('link[rel="stylesheet"], style'))
      w.document.head.append(node.cloneNode(true));
    w.document.documentElement.lang = document.documentElement.lang;
    w.document.documentElement.dir = document.documentElement.dir;
    w.addEventListener("pagehide", () => {
      current.current = null;
      setWin(null);
    });
    current.current = w;
    setWin(w);
  }, []);
  useEffect(() => {
    // Needs a recent click; when the browser refuses, the button in the sharing bar is the way in.
    if (sharing && auto) open().catch(() => {});
    if (!sharing) current.current?.close();
  }, [sharing, auto, open]);
  useEffect(() => () => current.current?.close(), []);
  return [win, open] as const;
}

/** The class in the floating window: the speaker big, a few others, the controls, and a bubble mode. */
export function FloatWindow({
  win,
  tracks,
  onBack,
  onLeave,
}: {
  win: Window;
  /** The speaker first, then everyone else, you last. */
  tracks: TrackReferenceOrPlaceholder[];
  onBack: () => void;
  onLeave: () => void;
}) {
  const t = useTranslations("Classroom");
  const [small, setSmall] = useState(false);
  const [first, ...others] = tracks;
  const resize = (to: boolean) => {
    setSmall(to);
    const size = to ? SMALL : BIG;
    win.resizeTo(size.width, size.height);
  };

  if (!first) return null;
  return createPortal(
    small ? (
      <button
        type="button"
        aria-label={t("float.expand")}
        onClick={() => resize(false)}
        className="block size-full cursor-pointer bg-room p-0"
      >
        <Tile trackRef={first} size="small" />
      </button>
    ) : (
      <div
        role="region"
        aria-label={t("float.label")}
        className="flex h-dvh flex-col gap-2 bg-room p-2 text-room-ink"
      >
        <div className="relative min-h-0 flex-1">
          <Tile trackRef={first} />
          <button
            type="button"
            aria-label={t("float.minimise")}
            title={t("float.minimise")}
            onClick={() => resize(true)}
            className="absolute end-2 top-2 grid size-8 place-items-center rounded-[10px] bg-room/70 text-room-ink hover:bg-room"
          >
            <Minimize2 aria-hidden size={16} />
          </button>
        </div>
        {others.length > 0 && (
          <ul className="grid h-16 shrink-0 grid-cols-3 gap-2">
            {others.slice(0, 3).map((tr) => (
              <li key={`${tr.participant.identity}-${tr.source}`}>
                <Tile trackRef={tr} size="small" self={tr.participant.isLocal} />
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center justify-center gap-2 pb-1">
          <FloatToggle source={Track.Source.Microphone} />
          <FloatToggle source={Track.Source.Camera} />
          <button
            type="button"
            aria-label={t("float.back")}
            title={t("float.back")}
            onClick={onBack}
            className="grid size-11 place-items-center rounded-full bg-room-raised text-room-ink hover:bg-room-line"
          >
            <Maximize2 aria-hidden size={18} />
          </button>
          <button
            type="button"
            aria-label={t("controls.leave")}
            title={t("controls.leave")}
            onClick={onLeave}
            className="flex h-11 items-center gap-1.5 rounded-pill bg-room-leave px-4 text-sm font-bold text-white"
          >
            <PhoneOff aria-hidden size={18} />
            {t("controls.leaveLabel")}
          </button>
        </div>
      </div>
    ),
    win.document.body,
  );
}

function FloatToggle({ source }: { source: Track.Source.Microphone | Track.Source.Camera }) {
  const t = useTranslations("Classroom.controls");
  const { enabled, pending, toggle } = useTrackToggle({ source });
  const mic = source === Track.Source.Microphone;
  const Icon = mic ? (enabled ? Mic : MicOff) : enabled ? Video : VideoOff;
  const label = mic ? (enabled ? t("micOff") : t("micOn")) : enabled ? t("camOff") : t("camOn");
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={pending}
      onClick={() => toggle()}
      className={`grid size-11 place-items-center rounded-full disabled:opacity-50 ${
        enabled ? "bg-room-raised text-room-ink hover:bg-room-line" : "bg-room-danger text-room"
      }`}
    >
      <Icon aria-hidden size={18} />
    </button>
  );
}
