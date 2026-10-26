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
import { AudioLines, Hand, Mic, MicOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { videoFit } from "@/lib/video-grid";
import { avatarColor, useBoxSize } from "./hooks";

export const isTeacher = (p: { attributes?: Record<string, string> }) =>
  p.attributes?.role === "teacher";
export const nameOf = (p: { name?: string; identity: string }) => p.name || p.identity;

/**
 * One person on the stage: their video (or a coloured initial), a name tag with the microphone
 * state, the raised-hand badge and the "their turn" tag. A teal ring shows who is speaking.
 */
export function Tile({
  trackRef,
  size = "large",
  self = false,
}: {
  trackRef: TrackReferenceOrPlaceholder;
  size?: "large" | "small" | "pip";
  self?: boolean;
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
  // Thumbnails always fill; big tiles fill only when the shapes match (videoFit).
  const fit = small ? "cover" : videoFit(boxSize, video);

  return (
    <figure
      ref={box}
      aria-label={name}
      className={`relative m-0 size-full overflow-hidden ${small ? "rounded-[14px]" : "rounded-[22px]"} ${
        showVideo ? "bg-room-raised" : "border border-room-line bg-room-card"
      } ${speaking || turn ? "ring-3 ring-room-teal ring-inset" : ""}`}
    >
      {showVideo ? (
        <VideoTrack
          trackRef={trackRef}
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
    </figure>
  );
}
