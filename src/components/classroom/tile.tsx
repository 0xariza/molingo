"use client";

import {
  VideoTrack,
  isTrackReference,
  useIsMuted,
  useIsSpeaking,
  useParticipantAttributes,
  type TrackReferenceOrPlaceholder,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { AudioLines, EllipsisVertical, Hand, Mic, MicOff, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { videoFit } from "@/lib/video-grid";
import { avatarColor, useBoxSize } from "./hooks";

export const isTeacher = (p: { attributes?: Record<string, string> }) =>
  p.attributes?.role === "teacher";
export const nameOf = (p: { name?: string; identity: string }) => p.name || p.identity;

export type TileAction = { label: string; icon: LucideIcon; onClick: () => void };

/**
 * One person on the stage: their video (or a coloured initial), a name tag with the microphone
 * state, the raised-hand badge and the "their turn" tag. A teal ring shows who is speaking.
 * `actions` adds a ⋮ menu (pin, where your own video goes); `videoStyle` zooms a shared screen.
 */
export function Tile({
  trackRef,
  size = "large",
  self = false,
  actions,
  videoStyle,
}: {
  trackRef: TrackReferenceOrPlaceholder;
  size?: "large" | "small" | "pip";
  self?: boolean;
  actions?: TileAction[];
  videoStyle?: CSSProperties;
}) {
  const t = useTranslations("Classroom");
  const p = trackRef.participant;
  const camMuted = useIsMuted(trackRef);
  const micMuted = useIsMuted({ participant: p, source: Track.Source.Microphone });
  const speaking = useIsSpeaking(p) && !micMuted;
  const { attributes } = useParticipantAttributes({ participant: p });
  const hand = attributes?.hand === "1";
  const turn = attributes?.turn === "1";
  const isShare = trackRef.source === Track.Source.ScreenShare;
  const showVideo = isTrackReference(trackRef) && !camMuted;
  const name = isShare
    ? t("stage.screen", { name: nameOf(p) })
    : self
      ? t("you")
      : isTeacher(p)
        ? `${nameOf(p)} · ${t("teacher")}`
        : nameOf(p);
  const small = size !== "large";
  const [box, boxSize] = useBoxSize<HTMLElement>();
  const [video, setVideo] = useState<{ width: number; height: number } | null>(null);
  // A screen is never cropped. Thumbnails always fill; big tiles fill only when the shapes match.
  const fit = isShare ? "contain" : small ? "cover" : videoFit(boxSize, video);

  return (
    <figure
      ref={box}
      aria-label={name}
      className={`group/tile relative m-0 size-full overflow-hidden ${small ? "rounded-[14px]" : "rounded-[22px]"} ${
        showVideo ? "bg-room-raised" : "border border-room-line bg-room-card"
      } ${speaking || turn ? "ring-3 ring-room-teal ring-inset" : ""}`}
    >
      {showVideo ? (
        <VideoTrack
          trackRef={trackRef}
          style={videoStyle}
          onResize={(e) => {
            const v = e.currentTarget;
            setVideo({ width: v.videoWidth, height: v.videoHeight });
          }}
          className={`size-full ${fit === "cover" ? "object-cover" : "object-contain"} ${self && !isShare ? "-scale-x-100" : ""}`}
        />
      ) : (
        <span className="absolute inset-0 grid place-items-center">
          <span
            aria-hidden="true"
            className={`grid place-items-center rounded-full font-bold text-white ${small ? "size-11 text-lg" : "size-24 text-4xl"}`}
            style={{ background: avatarColor(p.identity) }}
          >
            {nameOf(p).slice(0, 1).toUpperCase()}
          </span>
        </span>
      )}

      {!isShare && (hand || turn || (speaking && !small)) && (
        <span
          className={`absolute start-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-pill font-bold ${
            small ? "size-6 justify-center" : "h-7.5 px-2.5 text-[13px]"
          } ${hand ? "bg-room-cinnamon text-room" : "bg-room-teal-soft text-room-teal"}`}
        >
          {hand ? (
            <Hand aria-hidden size={small ? 14 : 16} strokeWidth={2.25} />
          ) : (
            <AudioLines aria-hidden size={small ? 14 : 16} />
          )}
          {!small && (hand ? t("stage.handUp") : turn ? t("stage.turn") : t("stage.speaking"))}
        </span>
      )}

      <figcaption
        className={`absolute bottom-2 start-2 inline-flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-pill bg-room/80 font-medium text-room-ink ${
          small ? "px-2 text-xs" : "h-8 px-3 text-sm"
        }`}
      >
        {!isShare &&
          (micMuted ? (
            <MicOff
              role="img"
              aria-label={t("stage.micOff")}
              size={small ? 12 : 16}
              className="shrink-0 text-room-danger"
            />
          ) : (
            !small && <Mic aria-hidden size={16} className="shrink-0" />
          ))}
        <span className="truncate">{name}</span>
      </figcaption>

      {actions && <TileMenu name={name} actions={actions} small={small} />}
    </figure>
  );
}

/**
 * The ⋮ button and its menu. The menu lives in <body>, so a small tile's clipping or the dragged
 * self-view's transform can't cut it off.
 */
function TileMenu({
  name,
  actions,
  small,
}: {
  name: string;
  actions: TileAction[];
  small: boolean;
}) {
  const t = useTranslations("Classroom.tile");
  const [at, setAt] = useState<DOMRect | null>(null);
  const width = 264;
  const height = actions.length * 44 + 12;
  return (
    <>
      <button
        type="button"
        aria-label={t("options", { name })}
        aria-haspopup="menu"
        aria-expanded={!!at}
        // Keeps a tap on the button from starting a drag of the floating self-view.
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => setAt(at ? null : e.currentTarget.getBoundingClientRect())}
        className={`absolute end-1.5 top-1.5 grid place-items-center rounded-full bg-room/85 text-room-ink transition-opacity group-hover/tile:opacity-100 focus-visible:opacity-100 ${
          small ? "size-8" : "size-9"
        } ${at ? "" : "[@media(hover:hover)]:opacity-0"}`}
      >
        <EllipsisVertical aria-hidden size={18} />
      </button>
      {at &&
        createPortal(
          // Portal events still bubble through React: keep the self-view from taking them as a drag.
          <div onPointerDown={(e) => e.stopPropagation()}>
            <div aria-hidden="true" className="fixed inset-0 z-40" onClick={() => setAt(null)} />
            <div
              role="menu"
              aria-label={t("options", { name })}
              onKeyDown={(e) => e.key === "Escape" && setAt(null)}
              className="fixed z-50 flex flex-col rounded-[14px] border border-room-line bg-room-raised p-1.5 text-room-ink shadow-[0_12px_32px_rgba(0,0,0,.5)]"
              style={{
                width,
                top: Math.max(8, Math.min(at.bottom + 4, innerHeight - height - 8)),
                left: Math.max(8, Math.min(at.right - width, innerWidth - width - 8)),
              }}
            >
              {actions.map((a, i) => (
                <button
                  key={a.label}
                  type="button"
                  role="menuitem"
                  autoFocus={i === 0}
                  onClick={() => {
                    setAt(null);
                    a.onClick();
                  }}
                  className="flex min-h-11 w-full items-center gap-3 rounded-[10px] px-3 text-start whitespace-nowrap hover:bg-room-line"
                >
                  <a.icon aria-hidden size={18} />
                  {a.label}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
