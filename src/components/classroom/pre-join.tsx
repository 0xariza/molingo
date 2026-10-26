"use client";

import { useMediaDevices, usePreviewTracks } from "@livekit/components-react";
import { Track, type LocalAudioTrack, type LocalVideoTrack } from "livekit-client";
import {
  ArrowRight,
  AudioLines,
  GraduationCap,
  Info,
  LoaderCircle,
  Mic,
  MicOff,
  Play,
  SwitchCamera,
  Video,
  VideoOff,
  Volume2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import type { LiveError } from "@/server/live/actions";
import { captureSize, playTestSound, useMicLevel } from "./hooks";
import type { ClassroomInfo, JoinChoices } from "./types";

const field =
  "h-12 w-full min-w-0 rounded-lg border border-control bg-white px-3 text-navy focus-visible:outline-teal";

/**
 * The device check before the room (PLAN §6): camera preview, microphone level, device pickers
 * and a speaker test. Tapping Join is also the user gesture iOS needs before audio can play.
 */
export function PreJoin({
  info,
  error,
  pending,
  onJoin,
}: {
  info: ClassroomInfo;
  error: LiveError | null;
  pending: boolean;
  onJoin: (choices: JoinChoices) => void;
}) {
  const t = useTranslations("Classroom");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [audioId, setAudioId] = useState("");
  const [videoId, setVideoId] = useState("");
  const [outputId, setOutputId] = useState("");
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [blocked, setBlocked] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const options = useMemo(
    () => ({
      audio: micOn ? { deviceId: audioId || undefined } : false,
      video: camOn
        ? videoId
          ? { deviceId: videoId }
          : { facingMode: facing, resolution: captureSize(640, 360) }
        : false,
      // Re-run after "Try again".
      attempt,
    }),
    [micOn, camOn, audioId, videoId, facing, attempt],
  );
  const tracks = usePreviewTracks(options, () => setBlocked(true));
  const audioTrack = tracks?.find((tr) => tr.kind === Track.Kind.Audio) as
    LocalAudioTrack | undefined;
  const videoTrack = tracks?.find((tr) => tr.kind === Track.Kind.Video) as
    LocalVideoTrack | undefined;
  const level = useMicLevel(audioTrack);

  const mics = useMediaDevices({ kind: "audioinput" });
  const cameras = useMediaDevices({ kind: "videoinput" });
  const speakers = useMediaDevices({ kind: "audiooutput" });

  const preview = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = preview.current;
    if (!el || !videoTrack) return;
    videoTrack.attach(el);
    return () => {
      videoTrack.detach(el);
    };
  }, [videoTrack]);

  const join = (audioOnly: boolean) => {
    // Free the camera and microphone first: iPhones can't open them twice.
    tracks?.forEach((tr) => tr.stop());
    onJoin({
      audio: micOn,
      video: camOn && !audioOnly,
      audioDeviceId: audioId || undefined,
      videoDeviceId: videoId || undefined,
      audioOutputId: outputId || undefined,
      audioOnly,
    });
  };

  const bars = [0.1, 0.25, 0.4, 0.55, 0.7, 0.85];
  const heard = level > 0.12;
  const round =
    "grid size-14 place-items-center rounded-full transition-colors disabled:opacity-60";

  return (
    <div className="min-h-dvh bg-page text-navy">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          href={info.backHref}
          className="inline-flex min-h-touch items-center gap-1.5 font-bold text-teal hover:underline"
        >
          <ArrowRight aria-hidden size={20} className="ltr:-scale-x-100" />
          {t("prejoin.back")}
        </Link>
      </header>

      <main
        id="main"
        className="mx-auto flex max-w-6xl flex-wrap items-start gap-8 px-4 pb-12 sm:px-6"
      >
        <section
          aria-label={t("prejoin.preview")}
          className="flex min-w-0 flex-[999_1_560px] flex-col gap-4"
        >
          <div className="relative aspect-[16/10] overflow-hidden rounded-[22px] bg-navy">
            {videoTrack ? (
              <video
                ref={preview}
                muted
                playsInline
                className="size-full -scale-x-100 object-contain"
                aria-hidden="true"
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-room-muted">
                <span className="flex flex-col items-center gap-3">
                  <VideoOff aria-hidden size={40} />
                  {t("prejoin.camOff")}
                </span>
              </div>
            )}

            {micOn && (
              <span
                role="status"
                className="absolute start-4 top-4 inline-flex h-9 items-center gap-2.5 rounded-pill bg-room/80 px-3.5 text-sm text-room-ink"
              >
                <Mic aria-hidden size={16} />
                <span aria-hidden="true" className="flex items-center gap-[3px]">
                  {bars.map((b, i) => (
                    <span
                      key={b}
                      className={`w-1 rounded-sm transition-colors ${level > b ? "bg-room-teal" : "bg-room-control"}`}
                      style={{ height: 6 + (i < 3 ? i : 5 - i) * 4 }}
                    />
                  ))}
                </span>
                {heard ? t("prejoin.micHeard") : t("prejoin.micQuiet")}
              </span>
            )}

            <div className="absolute inset-x-0 bottom-5 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setMicOn(!micOn)}
                aria-pressed={!micOn}
                aria-label={micOn ? t("controls.micOff") : t("controls.micOn")}
                className={`${round} ${micOn ? "bg-white/15 text-white hover:bg-white/25" : "bg-room-danger text-room"}`}
              >
                {micOn ? <Mic aria-hidden /> : <MicOff aria-hidden />}
              </button>
              <button
                type="button"
                onClick={() => setCamOn(!camOn)}
                aria-pressed={!camOn}
                aria-label={camOn ? t("controls.camOff") : t("controls.camOn")}
                className={`${round} ${camOn ? "bg-white/15 text-white hover:bg-white/25" : "bg-room-danger text-room"}`}
              >
                {camOn ? <Video aria-hidden /> : <VideoOff aria-hidden />}
              </button>
              {camOn && cameras.length > 1 && !videoId && (
                <button
                  type="button"
                  onClick={() => setFacing(facing === "user" ? "environment" : "user")}
                  aria-label={t("controls.flip")}
                  className={`${round} bg-white/15 text-white hover:bg-white/25`}
                >
                  <SwitchCamera aria-hidden />
                </button>
              )}
            </div>
          </div>

          {blocked && (
            <p
              role="alert"
              className="flex flex-wrap items-center gap-3 rounded-[14px] bg-cinnamon-soft p-3 text-sm text-navy"
            >
              <span className="min-w-0 flex-1">{t("prejoin.blocked")}</span>
              <button
                type="button"
                onClick={() => {
                  setBlocked(false);
                  setAttempt(attempt + 1);
                }}
                className="min-h-10 rounded-[12px] px-3 font-bold text-cinnamon-ink hover:bg-white"
              >
                {t("prejoin.retry")}
              </button>
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex min-w-0 flex-col gap-1.5 text-sm font-bold text-navy-muted">
              <span className="inline-flex items-center gap-1.5">
                <Mic aria-hidden size={16} />
                {t("prejoin.mic")}
              </span>
              <select
                className={field}
                value={audioId}
                onChange={(e) => setAudioId(e.target.value)}
              >
                {mics.map((d) => (
                  <option key={d.deviceId} value={d.deviceId === "default" ? "" : d.deviceId}>
                    {d.label || t("prejoin.mic")}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1.5 text-sm font-bold text-navy-muted">
              <span className="inline-flex items-center gap-1.5">
                <Video aria-hidden size={16} />
                {t("prejoin.camera")}
              </span>
              <select
                className={field}
                value={videoId}
                onChange={(e) => setVideoId(e.target.value)}
              >
                {cameras.map((d) => (
                  <option key={d.deviceId} value={d.deviceId === "default" ? "" : d.deviceId}>
                    {d.label || t("prejoin.camera")}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex min-w-0 flex-col gap-1.5 text-sm font-bold text-navy-muted">
              <span className="inline-flex items-center gap-1.5">
                <Volume2 aria-hidden size={16} />
                {t("prejoin.speaker")}
              </span>
              {speakers.length > 1 && (
                <select
                  aria-label={t("prejoin.speaker")}
                  className={field}
                  value={outputId}
                  onChange={(e) => setOutputId(e.target.value)}
                >
                  {speakers.map((d) => (
                    <option key={d.deviceId} value={d.deviceId === "default" ? "" : d.deviceId}>
                      {d.label || t("prejoin.speaker")}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={() => playTestSound(outputId || undefined)}
                className="flex h-12 items-center justify-center gap-2 rounded-lg border border-control bg-white px-3 font-bold text-teal hover:bg-teal-soft"
              >
                <Play aria-hidden size={18} />
                {t("prejoin.testSound")}
              </button>
            </div>
          </div>
        </section>

        <section className="flex min-w-0 flex-[1_1_340px] flex-col gap-5 pt-2">
          <div className="space-y-2">
            <h1 className="font-sans text-3xl font-extrabold tracking-normal normal-case text-navy">
              {t("prejoin.heading")}
            </h1>
            <p className="text-navy-muted">{t("prejoin.sub")}</p>
          </div>

          <div className="flex items-center gap-3 rounded-[14px] border border-hairline bg-white p-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-cinnamon-soft text-cinnamon-ink">
              <GraduationCap aria-hidden size={22} />
            </span>
            <span className="min-w-0 leading-snug">
              <b className="block text-lg text-navy">{info.title}</b>
              <small className="text-sm text-navy-muted">{info.when}</small>
            </span>
          </div>

          {error && (
            <p role="alert" className="rounded-[14px] bg-cinnamon-soft p-3 font-bold text-navy">
              {t(`errors.${error}`, { time: "" })}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => join(false)}
              className="flex h-14 items-center justify-center gap-2.5 rounded-[14px] bg-cinnamon text-lg font-extrabold text-navy hover:brightness-95 disabled:opacity-70"
            >
              {pending ? (
                <>
                  <LoaderCircle aria-hidden size={20} className="animate-spin" />
                  {t("prejoin.joining")}
                </>
              ) : (
                <>
                  {t("prejoin.join")}
                  <ArrowRight aria-hidden size={20} className="rtl:-scale-x-100" />
                </>
              )}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => join(true)}
              className="flex min-h-12 items-center justify-center gap-2 rounded-[14px] px-3 font-bold text-teal hover:bg-teal-soft disabled:opacity-70"
            >
              <AudioLines aria-hidden size={18} />
              {t("prejoin.joinAudio")}
            </button>
          </div>

          <p className="flex items-start gap-2.5 rounded-[14px] bg-teal-soft p-3 text-sm text-navy">
            <Info aria-hidden size={20} className="mt-0.5 shrink-0 text-teal" />
            {t("prejoin.vpnTip")}
          </p>
        </section>
      </main>
    </div>
  );
}
