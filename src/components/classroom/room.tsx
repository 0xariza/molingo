"use client";

import {
  isTrackReference,
  useChat,
  useConnectionQualityIndicator,
  useConnectionState,
  useLocalParticipant,
  useParticipantAttributes,
  useParticipants,
  useRoomContext,
  useTrackToggle,
  useTracks,
  type TrackReferenceOrPlaceholder,
} from "@livekit/components-react";
import { ConnectionQuality, ConnectionState, Track, type LocalVideoTrack } from "livekit-client";
import {
  AudioLines,
  Clock,
  ClipboardList,
  Ellipsis,
  Hand,
  MessageCircle,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Signal,
  SwitchCamera,
  Users,
  Video,
  VideoOff,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import type { Locale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";
import { bestTileWidth } from "@/lib/video-grid";
import { useAudioOnly, useBoxSize, useNarrow, useNow, useWakeLock } from "./hooks";
import { ChatPanel, ConfirmDialog, PeoplePanel, VisitorPanel } from "./panels";
import { Tile, isTeacher } from "./tile";
import type { ClassroomInfo } from "./types";

type PanelName = "people" | "chat" | "visitor" | null;

/** The live room (design: Hoopo dark room). Rendered inside <LiveKitRoom>. */
export function Room({
  info,
  startAudioOnly,
  onLeave,
}: {
  info: ClassroomInfo;
  startAudioOnly: boolean;
  onLeave: () => void;
}) {
  const t = useTranslations("Classroom");
  const locale = useLocale() as Locale;
  const room = useRoomContext();
  const narrow = useNarrow();
  const state = useConnectionState();
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const { attributes: mine } = useParticipantAttributes({ participant: localParticipant });
  // Mona's visitor panel starts open beside the call; on a phone it would cover the call.
  const [panel, setPanel] = useState<PanelName>(info.visitor && !narrow ? "visitor" : null);
  const [leaving, setLeaving] = useState(false);
  const [more, setMore] = useState(false);
  const [audioOnly, setAudioOnly] = useState(startAudioOnly);
  const chat = useChat();
  // Chat messages from others after this moment count as unread while the chat is closed.
  const [seenAt, setSeenAt] = useState(() => Date.now());
  const teacher = info.role === "teacher";
  useWakeLock();
  const [grid, gridSize] = useBoxSize<HTMLUListElement>();
  useAudioOnly(room, audioOnly);

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  const self = tracks.find((tr) => tr.participant.isLocal && tr.source === Track.Source.Camera);
  const share = tracks.find((tr) => isTrackReference(tr) && tr.source === Track.Source.ScreenShare);
  // Mona first, then raised hands, then everyone else in joining order.
  const rank = (tr: TrackReferenceOrPlaceholder) =>
    isTeacher(tr.participant) ? 0 : tr.participant.attributes.hand === "1" ? 1 : 2;
  const others = tracks
    .filter((tr) => !tr.participant.isLocal && tr.source === Track.Source.Camera)
    .sort((a, b) => rank(a) - rank(b));
  const teacherHere = teacher || participants.some((p) => isTeacher(p) && !p.isLocal);

  const unread =
    panel === "chat"
      ? 0
      : chat.chatMessages.filter((m) => !m.from?.isLocal && m.timestamp > seenAt).length;
  const hands = participants.filter((p) => p.attributes.hand === "1").length;
  const handUp = mine?.hand === "1";
  const myTurn = mine?.turn === "1";
  const n = (v: number) => formatNumber(v, locale);
  const showPanel = (name: PanelName) => {
    if (panel === "chat" || name === "chat") setSeenAt(Date.now());
    setPanel(name);
  };
  const toggle = (name: PanelName) => showPanel(panel === name ? null : name);

  const notice: { text: string; tone: "info" | "turn" | "hand" } | null =
    state === ConnectionState.Connecting
      ? { text: t("notice.connecting"), tone: "info" }
      : state === ConnectionState.Reconnecting || state === ConnectionState.SignalReconnecting
        ? { text: t("notice.reconnecting"), tone: "info" }
        : myTurn
          ? { text: t("notice.myTurn"), tone: "turn" }
          : handUp
            ? { text: t("notice.handUp"), tone: "hand" }
            : !teacherHere
              ? { text: t("notice.noTeacher"), tone: "info" }
              : audioOnly
                ? { text: t("notice.audioOnly"), tone: "info" }
                : null;

  // Phones: one main tile (screen share, then Mona, then whoever comes first) above a strip.
  const main = share ?? others[0];
  const strip = narrow ? [self, ...others.filter((tr) => tr !== main)] : others;

  const stage = narrow ? (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5">
      <div className="relative min-h-0 flex-1">
        {main ? (
          <Tile trackRef={main} />
        ) : (
          <Alone text={teacher ? t("stage.aloneTeacher") : t("stage.aloneLearner")} />
        )}
        {notice && <Notice {...notice} />}
      </div>
      <ul aria-label={t("stage.label")} className="flex gap-2 overflow-x-auto">
        {strip.map(
          (tr) =>
            tr && (
              <li key={`${tr.participant.identity}-${tr.source}`} className="h-26 w-21 shrink-0">
                <Tile trackRef={tr} size="small" self={tr.participant.isLocal} />
              </li>
            ),
        )}
      </ul>
    </div>
  ) : (
    <div
      aria-label={t("stage.label")}
      className="relative flex min-h-0 min-w-0 flex-[999_1_640px] flex-col gap-3"
    >
      {share ? (
        <>
          <div className="min-h-0 flex-1">
            <Tile trackRef={share} />
          </div>
          <ul className="flex h-30 shrink-0 gap-3 overflow-x-auto">
            {[self, ...others].map(
              (tr) =>
                tr && (
                  <li key={tr.participant.identity} className="aspect-video h-full shrink-0">
                    <Tile trackRef={tr} size="small" self={tr.participant.isLocal} />
                  </li>
                ),
            )}
          </ul>
        </>
      ) : others.length === 0 ? (
        <Alone text={teacher ? t("stage.aloneTeacher") : t("stage.aloneLearner")}>
          {self && (
            <div className="aspect-video w-full max-w-md">
              <Tile trackRef={self} self />
            </div>
          )}
        </Alone>
      ) : (
        <ul
          ref={grid}
          className="flex min-h-0 flex-1 flex-wrap content-center justify-center gap-3"
        >
          {others.map((tr) => (
            <li
              key={tr.participant.identity}
              className="aspect-video"
              style={{ width: bestTileWidth(gridSize, others.length, 12) }}
            >
              <Tile trackRef={tr} />
            </li>
          ))}
        </ul>
      )}
      {self && others.length > 0 && !share && (
        <div className="absolute end-4 bottom-4 aspect-video w-50 rounded-[14px] shadow-[0_8px_24px_rgba(0,0,0,.45)] ring-2 ring-room">
          <Tile trackRef={self} size="pip" self />
        </div>
      )}
      {notice && <Notice {...notice} />}
    </div>
  );

  const panelEl =
    panel === "chat" ? (
      <ChatPanel chat={chat} narrow={narrow} locale={locale} onClose={() => showPanel(null)} />
    ) : panel === "visitor" && info.visitor ? (
      <VisitorPanel visitor={info.visitor} narrow={narrow} onClose={() => showPanel(null)} />
    ) : panel === "people" ? (
      <PeoplePanel
        sessionId={info.sessionId}
        participants={participants}
        teacher={teacher && info.moderation}
        narrow={narrow}
        locale={locale}
        onClose={() => showPanel(null)}
      />
    ) : null;

  const handButton = (
    <ControlButton
      icon={Hand}
      label={handUp ? t("controls.handRaised") : t("controls.hand")}
      action={handUp ? t("controls.handDown") : t("controls.handUp")}
      tone={handUp ? "on" : "default"}
      pressed={handUp}
      onClick={() => localParticipant.setAttributes({ hand: handUp ? "" : "1" })}
    />
  );
  const peopleButton = info.visitor ? (
    <ControlButton
      icon={ClipboardList}
      label={t("visitor.button")}
      action={t("visitor.button")}
      pressed={panel === "visitor"}
      onClick={() => toggle("visitor")}
    />
  ) : (
    <ControlButton
      icon={Users}
      label={t("controls.people")}
      action={hands ? t("controls.peopleHands", { count: hands }) : t("controls.people")}
      pressed={panel === "people"}
      badge={hands ? { text: n(hands), tone: "hand" } : undefined}
      onClick={() => toggle("people")}
    />
  );
  const chatButton = (
    <ControlButton
      icon={MessageCircle}
      label={t("controls.chat")}
      action={unread ? t("controls.chatUnread", { count: unread }) : t("controls.chat")}
      pressed={panel === "chat"}
      badge={unread ? { text: n(unread), tone: "plain" } : undefined}
      onClick={() => toggle("chat")}
    />
  );
  const leaveButton = (
    <ControlButton
      icon={PhoneOff}
      label={t("controls.leaveLabel")}
      action={t("controls.leave")}
      tone="leave"
      wide={!narrow}
      onClick={() => setLeaving(true)}
    />
  );
  const moreMenu = (
    <MoreMenu
      open={more}
      onToggle={() => setMore(!more)}
      audioOnly={audioOnly}
      onAudioOnly={() => {
        setAudioOnly(!audioOnly);
        if (!audioOnly) localParticipant.setCameraEnabled(false);
        setMore(false);
      }}
      onFlip={async () => {
        const cam = localParticipant.getTrackPublication(Track.Source.Camera)?.track as
          LocalVideoTrack | undefined;
        const facing = cam?.mediaStreamTrack.getSettings().facingMode;
        await cam?.restartTrack({ facingMode: facing === "environment" ? "user" : "environment" });
        setMore(false);
      }}
      canFlip={narrow && localParticipant.isCameraEnabled}
      narrow={narrow}
    />
  );

  return (
    <div className="flex h-dvh flex-col bg-room text-room-ink">
      <TopBar
        info={info}
        count={participants.length}
        narrow={narrow}
        more={narrow ? moreMenu : null}
      />

      <main
        id="main"
        className={`flex min-h-0 flex-1 gap-4 ${narrow ? "flex-col px-3" : "px-6 pt-4 pb-2"}`}
      >
        {stage}
        {panelEl}
      </main>

      <footer
        aria-label={t("controls.bar")}
        className={`flex items-start gap-x-6 gap-y-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] ${
          narrow ? "justify-between px-3 pt-2" : "flex-wrap justify-between px-6 pt-3"
        }`}
      >
        {!narrow && (
          <p className="flex min-w-40 flex-1 items-center gap-2 self-center text-sm text-room-muted">
            {info.title}
          </p>
        )}
        <div className={`flex items-start ${narrow ? "w-full justify-between" : "gap-2.5"}`}>
          <MediaButton source={Track.Source.Microphone} />
          <MediaButton source={Track.Source.Camera} disabled={audioOnly} />
          {teacher && !narrow && <MediaButton source={Track.Source.ScreenShare} />}
          {!teacher && handButton}
          {narrow && (teacher ? peopleButton : chatButton)}
          {narrow && teacher && chatButton}
          {!narrow && moreMenu}
          {leaveButton}
        </div>
        {!narrow && (
          <div className="flex min-w-40 flex-1 items-start justify-end gap-2.5">
            {peopleButton}
            {chatButton}
          </div>
        )}
      </footer>

      {leaving && (
        <ConfirmDialog
          title={t("leave.title")}
          body={t("leave.body")}
          cancel={t("leave.stay")}
          confirm={t("leave.leave")}
          onCancel={() => setLeaving(false)}
          onConfirm={() => {
            setLeaving(false);
            onLeave();
          }}
        />
      )}
    </div>
  );
}

function TopBar({
  info,
  count,
  narrow,
  more,
}: {
  info: ClassroomInfo;
  count: number;
  narrow: boolean;
  more: ReactNode;
}) {
  const t = useTranslations("Classroom");
  const locale = useLocale() as Locale;
  const now = useNow();
  const { localParticipant } = useLocalParticipant();
  const { quality } = useConnectionQualityIndicator({ participant: localParticipant });
  const minutes = Math.max(0, Math.floor((now.getTime() - info.startsAt.getTime()) / 60_000));
  const elapsed = `${formatNumber(Math.floor(minutes / 60), locale)}:${formatNumber(minutes % 60, locale).padStart(2, formatNumber(0, locale))}`;
  const level =
    quality === ConnectionQuality.Excellent
      ? 4
      : quality === ConnectionQuality.Good
        ? 3
        : quality === ConnectionQuality.Poor
          ? 2
          : quality === ConnectionQuality.Lost
            ? 0
            : 1;
  const qualityLabel = t(
    `header.quality.${
      quality === ConnectionQuality.Excellent
        ? "excellent"
        : quality === ConnectionQuality.Good
          ? "good"
          : quality === ConnectionQuality.Poor
            ? "poor"
            : quality === ConnectionQuality.Lost
              ? "lost"
              : "unknown"
    }`,
  );

  const signal = (
    <Signal
      aria-hidden
      size={narrow ? 14 : 16}
      strokeWidth={2.25}
      className={
        level >= 3 ? "text-room-teal" : level === 2 ? "text-room-cinnamon" : "text-room-danger"
      }
    />
  );

  if (narrow)
    return (
      <header className="flex items-center gap-2.5 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2.5">
        <div className="min-w-0 flex-1 leading-snug">
          <h1 className="truncate font-sans text-base font-bold tracking-normal normal-case text-room-ink">
            {info.title}
          </h1>
          <p className="flex items-center gap-2 text-[13px] text-room-muted">
            <span className="inline-flex items-center gap-1">
              <span aria-hidden="true" className="size-1.75 rounded-full bg-room-live" />
              <span className="sr-only">{t("header.elapsed")}</span>
              <span className="tabular-nums">{elapsed}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              {signal}
              {qualityLabel}
            </span>
          </p>
        </div>
        {more}
      </header>
    );

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-room-line px-6 py-3.5">
      <div className="flex min-w-0 items-center gap-3.5">
        <span className="inline-flex items-center gap-1.5 rounded-pill bg-[#123526] px-2.5 py-1 text-[13px] font-bold text-room-live">
          <span aria-hidden="true" className="size-2 rounded-full bg-room-live" />
          {t("header.live")}
        </span>
        <h1 className="truncate font-sans text-lg font-bold tracking-normal normal-case text-room-ink">
          {info.title}
        </h1>
        <span className="text-sm text-room-muted">{t("header.people", { count })}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-room-line bg-room-card px-3 text-sm">
          <Clock aria-hidden size={16} />
          <span className="sr-only">{t("header.elapsed")}</span>
          <span className="tabular-nums">{elapsed}</span>
        </span>
        <span className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-room-line bg-room-card px-3 text-sm">
          {signal}
          {qualityLabel}
        </span>
      </div>
    </header>
  );
}

function Notice({ text, tone }: { text: string; tone: "info" | "turn" | "hand" }) {
  const Icon = tone === "turn" ? AudioLines : tone === "hand" ? Hand : null;
  return (
    <p
      role="status"
      className={`absolute inset-x-3 top-3 z-10 mx-auto flex max-w-xl items-center gap-2 rounded-[14px] px-3.5 py-2.5 text-sm font-medium shadow-[0_8px_24px_rgba(0,0,0,.35)] ${
        tone === "turn"
          ? "bg-room-teal-soft text-room-teal"
          : tone === "hand"
            ? "bg-room-cinnamon-soft text-room-cinnamon-ink"
            : "bg-room-raised text-room-ink"
      }`}
    >
      {Icon && <Icon aria-hidden size={18} className="shrink-0" />}
      {text}
    </p>
  );
}

function Alone({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <div className="flex size-full min-h-60 flex-col items-center justify-center gap-4 rounded-[22px] border border-dashed border-room-line p-6 text-center text-room-muted">
      {children}
      <p className="max-w-sm">{text}</p>
    </div>
  );
}

/** A labelled 56 px control: icon in a rounded square, its name underneath. */
function ControlButton({
  icon: Icon,
  label,
  action,
  tone = "default",
  pressed,
  badge,
  wide = false,
  disabled = false,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  /** What a tap does, for screen readers and the tooltip. */
  action: string;
  tone?: "default" | "off" | "on" | "leave";
  pressed?: boolean;
  badge?: { text: string; tone: "hand" | "plain" };
  wide?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const square =
    tone === "off"
      ? "bg-room-danger text-room"
      : tone === "on"
        ? "bg-room-cinnamon text-room"
        : tone === "leave"
          ? "bg-room-leave text-white"
          : pressed
            ? "bg-room-teal-soft text-room-teal"
            : "bg-room-raised text-room-ink group-hover:bg-room-line";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={action}
      aria-pressed={pressed}
      title={action}
      className="group relative flex min-w-16 flex-col items-center gap-1.5 rounded-[18px] disabled:opacity-50"
    >
      <span
        className={`flex h-14 items-center justify-center gap-2 rounded-[18px] transition-colors ${wide ? "px-5" : "w-14"} ${square}`}
      >
        <Icon aria-hidden size={24} strokeWidth={tone === "on" ? 2.25 : 2} />
        {wide && <span className="font-bold">{label}</span>}
      </span>
      {!wide && (
        <span
          className={`text-xs ${tone === "off" ? "text-room-danger" : tone === "on" ? "font-bold text-room-cinnamon-ink" : "text-room-muted"}`}
        >
          {label}
        </span>
      )}
      {badge && (
        <span
          aria-hidden="true"
          className={`absolute -top-1 end-0 grid h-5.5 min-w-5.5 place-items-center rounded-pill border-2 border-room px-1.5 text-xs font-bold text-room ${
            badge.tone === "hand" ? "bg-room-cinnamon" : "bg-room-ink"
          }`}
        >
          {badge.text}
        </span>
      )}
    </button>
  );
}

/** Microphone, camera or screen-share toggle. Off is red with a slash, never colour alone. */
function MediaButton({
  source,
  disabled = false,
}: {
  source: Track.Source.Microphone | Track.Source.Camera | Track.Source.ScreenShare;
  disabled?: boolean;
}) {
  const t = useTranslations("Classroom.controls");
  const { enabled, pending, toggle } = useTrackToggle({
    source,
    captureOptions: source === Track.Source.ScreenShare ? { audio: true } : undefined,
  });
  if (source === Track.Source.ScreenShare)
    return (
      <ControlButton
        icon={MonitorUp}
        label={enabled ? t("sharing") : t("shareLabel")}
        action={enabled ? t("stopShare") : t("share")}
        pressed={enabled}
        disabled={pending}
        onClick={() => toggle()}
      />
    );
  const mic = source === Track.Source.Microphone;
  return (
    <ControlButton
      icon={mic ? (enabled ? Mic : MicOff) : enabled ? Video : VideoOff}
      label={mic ? (enabled ? t("mic") : t("muted")) : enabled ? t("camera") : t("cameraOff")}
      action={mic ? (enabled ? t("micOff") : t("micOn")) : enabled ? t("camOff") : t("camOn")}
      tone={enabled ? "default" : "off"}
      disabled={pending || disabled}
      onClick={() => toggle()}
    />
  );
}

/** "More": audio-only mode for weak networks, and the front/back camera on phones. */
function MoreMenu({
  open,
  onToggle,
  audioOnly,
  onAudioOnly,
  onFlip,
  canFlip,
  narrow,
}: {
  open: boolean;
  onToggle: () => void;
  audioOnly: boolean;
  onAudioOnly: () => void;
  onFlip: () => void;
  canFlip: boolean;
  narrow: boolean;
}) {
  const t = useTranslations("Classroom.controls");
  const item =
    "flex min-h-11 w-full items-center gap-2.5 rounded-[10px] px-3 text-start text-room-ink hover:bg-room-line";
  return (
    <div className="relative">
      {narrow ? (
        <button
          type="button"
          aria-label={t("more")}
          aria-expanded={open}
          onClick={onToggle}
          className="grid size-11 place-items-center rounded-[14px] bg-room-card text-room-ink"
        >
          <Ellipsis aria-hidden size={22} />
        </button>
      ) : (
        <ControlButton
          icon={Ellipsis}
          label={t("more")}
          action={t("more")}
          pressed={open}
          onClick={onToggle}
        />
      )}
      {open && (
        <div
          className={`absolute end-0 z-30 flex w-64 flex-col rounded-[14px] border border-room-line bg-room-raised p-1.5 shadow-[0_12px_32px_rgba(0,0,0,.5)] ${narrow ? "top-12" : "bottom-24"}`}
        >
          <button type="button" className={item} onClick={onAudioOnly} aria-pressed={audioOnly}>
            <AudioLines aria-hidden size={18} />
            {audioOnly ? t("showVideo") : t("audioOnly")}
          </button>
          {canFlip && (
            <button type="button" className={item} onClick={onFlip}>
              <SwitchCamera aria-hidden size={18} />
              {t("flip")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
