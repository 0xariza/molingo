"use client";

import { LiveKitRoom, RoomAudioRenderer, StartAudio } from "@livekit/components-react";
import { DisconnectReason, VideoPresets } from "livekit-client";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { Link } from "@/i18n/navigation";
import type { JoinResult, LiveError } from "@/server/live/actions";
import { captureSize } from "./hooks";
import { PreJoin } from "./pre-join";
import { Room } from "./room";
import type { ClassroomInfo, JoinChoices } from "./types";

type Stage =
  | { kind: "prejoin" }
  | { kind: "room"; url: string; token: string; choices: JoinChoices }
  | { kind: "left" }
  | { kind: "removed" };

/** Pre-join → room → left. Learners send 360p; Mona 540p, for her screen and face. */
export function Classroom({
  info,
  join: joinAction,
}: {
  info: ClassroomInfo;
  /** A Server Action bound to this room: a session, or a level check. */
  join: () => Promise<JoinResult>;
}) {
  const t = useTranslations("Classroom");
  const [stage, setStage] = useState<Stage>({ kind: "prejoin" });
  const [error, setError] = useState<LiveError | null>(null);
  const [pending, start] = useTransition();
  const connected = useRef(false);

  const join = (choices: JoinChoices) =>
    start(async () => {
      setError(null);
      connected.current = false;
      const result = await joinAction();
      if (!result.ok) {
        setError(result.error);
        setStage(result.error === "removed" ? { kind: "removed" } : { kind: "prejoin" });
        return;
      }
      setStage({ kind: "room", url: result.url, token: result.token, choices });
    });

  if (stage.kind === "room") {
    const { choices } = stage;
    const preset = info.role === "teacher" ? VideoPresets.h540 : VideoPresets.h360;
    return (
      <LiveKitRoom
        serverUrl={stage.url}
        token={stage.token}
        connect
        audio={choices.audio ? { deviceId: choices.audioDeviceId } : false}
        video={
          choices.video
            ? {
                deviceId: choices.videoDeviceId,
                resolution: captureSize(preset.width, preset.height),
              }
            : false
        }
        options={{
          adaptiveStream: true,
          dynacast: true,
          audioOutput: choices.audioOutputId ? { deviceId: choices.audioOutputId } : undefined,
          publishDefaults: {
            simulcast: true,
            videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360],
          },
        }}
        onConnected={() => (connected.current = true)}
        onDisconnected={(reason) => {
          if (reason === DisconnectReason.PARTICIPANT_REMOVED) return setStage({ kind: "removed" });
          // Never got in (the network blocked the media, the server is down): back to pre-join.
          if (!connected.current) setError("unavailable");
          setStage(connected.current ? { kind: "left" } : { kind: "prejoin" });
        }}
      >
        <Room
          info={info}
          startAudioOnly={choices.audioOnly}
          onLeave={() => setStage({ kind: "left" })}
        />
        <RoomAudioRenderer />
        <StartAudio
          label={t("notice.startAudio")}
          className="fixed inset-x-4 bottom-32 z-40 mx-auto block min-h-12 max-w-sm rounded-[14px] bg-room-cinnamon px-4 font-bold text-room"
        />
      </LiveKitRoom>
    );
  }

  if (stage.kind === "left" || stage.kind === "removed") {
    const left = stage.kind === "left";
    return (
      <main
        id="main"
        className="grid min-h-dvh place-items-center bg-room px-4 text-center text-room-ink"
      >
        <div className="flex max-w-md flex-col items-center gap-4">
          <h1 className="font-sans text-2xl font-bold tracking-normal normal-case text-room-ink">
            {left ? t("left.title") : t("removed.title")}
          </h1>
          <p className="text-room-muted">{left ? t("left.body") : t("removed.body")}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {left && (
              <button
                type="button"
                onClick={() => setStage({ kind: "prejoin" })}
                className="min-h-12 rounded-[14px] bg-room-cinnamon px-6 font-bold text-room"
              >
                {t("left.rejoin")}
              </button>
            )}
            <Link
              href={info.backHref}
              className="inline-flex min-h-12 items-center rounded-[14px] border border-room-control px-6 font-bold hover:bg-room-raised"
            >
              {info.backLabel}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return <PreJoin info={info} error={error} pending={pending} onJoin={join} />;
}
