"use client";

import { useTrackToggle, type TrackReferenceOrPlaceholder } from "@livekit/components-react";
import { Track } from "livekit-client";
import {
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  MonitorUp,
  PhoneOff,
  Video,
  VideoOff,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react";
import { createPortal } from "react-dom";
import { ReactionStream, ReactionTray } from "./reactions";
import { Tile } from "./tile";

declare global {
  interface Window {
    documentPictureInPicture?: {
      requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
    };
  }
}

const BIG = { width: 360, height: 480 };
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

/**
 * The floating window while you present (as in Meet): what you're sharing on top with your own
 * video in its corner, then the class, reactions and the controls. It has a bubble mode too.
 */
export function FloatWindow({
  win,
  preview,
  tracks,
  reactions,
  onReact,
  onStopShare,
  onBack,
  onLeave,
}: {
  win: Window;
  /** Your own shared screen. */
  preview: TrackReferenceOrPlaceholder;
  /** The speaker first, then everyone else, you last. */
  tracks: TrackReferenceOrPlaceholder[];
  reactions: ComponentProps<typeof ReactionStream>["shown"];
  onReact: ComponentProps<typeof ReactionTray>["onReact"];
  onStopShare: () => void;
  onBack: () => void;
  onLeave: () => void;
}) {
  const t = useTranslations("Classroom");
  const [small, setSmall] = useState(false);
  const [first] = tracks;
  const self = tracks.find((tr) => tr.participant.isLocal);
  const others = tracks.filter((tr) => !tr.participant.isLocal);
  const resize = (to: boolean) => {
    setSmall(to);
    const size = to ? SMALL : BIG;
    win.resizeTo(size.width, size.height);
  };

  return createPortal(
    small ? (
      <button
        type="button"
        aria-label={t("float.expand")}
        onClick={() => resize(false)}
        className="block size-full cursor-pointer bg-room p-0"
      >
        {first && <Tile trackRef={first} size="small" />}
      </button>
    ) : (
      <div
        role="region"
        aria-label={t("float.label")}
        className="flex h-dvh min-w-0 flex-col gap-2 overflow-hidden bg-room p-2 text-room-ink"
      >
        <p className="flex shrink-0 items-center gap-2 px-1 text-sm font-bold">
          <MonitorUp aria-hidden size={16} className="shrink-0 text-room-teal" />
          <span className="min-w-0 flex-1 truncate">{t("float.presenting")}</span>
          <button
            type="button"
            aria-label={t("float.minimise")}
            title={t("float.minimise")}
            onClick={() => resize(true)}
            className="grid size-8 shrink-0 place-items-center rounded-[10px] text-room-muted hover:bg-room-line hover:text-room-ink"
          >
            <Minimize2 aria-hidden size={16} />
          </button>
        </p>
        <div className="relative min-h-0 flex-1">
          <Tile trackRef={preview} />
          {self && (
            <div className="absolute end-2 bottom-2 aspect-video w-[34%] overflow-hidden rounded-[10px] shadow-[0_4px_16px_rgba(0,0,0,.5)]">
              <Tile trackRef={self} size="small" self />
            </div>
          )}
          <ReactionStream shown={reactions} className="start-2 bottom-12" />
        </div>
        {others.length > 0 && (
          <ul className="grid shrink-0 grid-cols-3 gap-2">
            {others.slice(0, 3).map((tr) => (
              <li key={`${tr.participant.identity}-${tr.source}`} className="aspect-video">
                <Tile trackRef={tr} size="small" />
              </li>
            ))}
          </ul>
        )}
        <div className="shrink-0 overflow-x-auto">
          <ReactionTray onReact={onReact} />
        </div>
        <div className="flex shrink-0 items-center justify-center gap-2 pb-1">
          <FloatToggle source={Track.Source.Microphone} />
          <FloatToggle source={Track.Source.Camera} />
          <button
            type="button"
            aria-label={t("controls.stopShare")}
            aria-pressed
            title={t("controls.stopShare")}
            onClick={onStopShare}
            className="grid size-11 place-items-center rounded-full bg-room-teal-soft text-room-teal hover:bg-room-line"
          >
            <MonitorUp aria-hidden size={18} />
          </button>
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
            className="grid h-11 w-14 place-items-center rounded-pill bg-room-leave text-white"
          >
            <PhoneOff aria-hidden size={18} />
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
