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
  useSpeakingParticipants,
  useTrackToggle,
  useTracks,
  type TrackReferenceOrPlaceholder,
} from "@livekit/components-react";
import {
  ConnectionQuality,
  ConnectionState,
  DisconnectReason,
  RoomEvent,
  Track,
  type LocalAudioTrack,
  type LocalVideoTrack,
  type RemoteParticipant,
} from "livekit-client";
import {
  AudioLines,
  Clock,
  ClipboardList,
  Ellipsis,
  Hand,
  LayoutGrid,
  MessageCircle,
  Mic,
  MicOff,
  Minimize2,
  MonitorUp,
  PhoneOff,
  PictureInPicture2,
  Pin,
  PanelRight,
  PinOff,
  Signal,
  SmilePlus,
  SwitchCamera,
  Unplug,
  Users,
  Video,
  VideoOff,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import type { Locale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";
import { canAutoFloat } from "@/lib/float-window";
import { gridTileSize } from "@/lib/video-grid";
import {
  useAudioOnly,
  useBoxSize,
  useMediaQuery,
  useNarrow,
  useNow,
  useTalkingWhileMuted,
  useWakeLock,
} from "./hooks";
import { FloatWindow, floatSupported, useFloatWindow } from "./float-window";
import { ChatPanel, ConfirmDialog, PeoplePanel, VisitorPanel } from "./panels";
import { ReactionStream, ReactionTray, useReactions } from "./reactions";
import { FloatingSelf } from "./self-view";
import { ShareView } from "./share-view";
import { Tile, isTeacher, nameOf, type TileAction } from "./tile";
import type { ClassroomInfo } from "./types";

/** Why someone vanished that means their network, not a choice (unknown counts too). */
const NETWORK_REASONS = new Set<DisconnectReason>([
  DisconnectReason.SIGNAL_CLOSE,
  DisconnectReason.CONNECTION_TIMEOUT,
  DisconnectReason.MEDIA_FAILURE,
  DisconnectReason.STATE_MISMATCH,
  DisconnectReason.SERVER_SHUTDOWN,
  DisconnectReason.MIGRATION,
]);

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
  const landscapePhone = useMediaQuery("(orientation: landscape) and (max-height: 500px)");
  const state = useConnectionState();
  const participants = useParticipants();
  const { localParticipant, isMicrophoneEnabled, microphoneTrack } = useLocalParticipant();
  const { attributes: mine } = useParticipantAttributes({ participant: localParticipant });
  // Mona's visitor panel starts open beside the call; on a phone it would cover the call.
  const [panel, setPanel] = useState<PanelName>(info.visitor && !narrow ? "visitor" : null);
  const [leaving, setLeaving] = useState(false);
  const [more, setMore] = useState(false);
  const [audioOnly, setAudioOnly] = useState(startAudioOnly);
  const [pinned, setPinned] = useState<string | null>(null);
  // "auto": in the people column beside a big tile on desktop (as in Meet), floating otherwise.
  const [selfPick, setSelfMode] = useState<"auto" | "float" | "grid" | "min">("auto");
  // Desktop only (a phone always shows one big tile): everyone equal, or the speaker big.
  const [view, setView] = useState<"grid" | "speaker">("grid");
  const speaking = useSpeakingParticipants();
  const [reacting, setReacting] = useState(false);
  const reactions = useReactions(t("you"));
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
  const anyShare = tracks.find(
    (tr) => isTrackReference(tr) && tr.source === Track.Source.ScreenShare,
  );
  // Your own shared screen isn't shown back to you (a hall of mirrors): a "presenting" bar instead.
  const presenting = !!anyShare?.participant.isLocal;
  const share = presenting ? undefined : anyShare;
  // While you present, the class follows you in a small always-on-top window (see float-window).
  const surface = localParticipant
    .getTrackPublication(Track.Source.ScreenShare)
    ?.track?.mediaStreamTrack.getSettings().displaySurface;
  const wholeScreen = presenting && !canAutoFloat(surface);
  const [floatWin, openFloat] = useFloatWindow(presenting, !narrow && !wholeScreen);
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

  // A connection that stays weak for 20 seconds gets an offer to drop video (once per class).
  const { quality } = useConnectionQualityIndicator({ participant: localParticipant });
  const weak = quality === ConnectionQuality.Poor || quality === ConnectionQuality.Lost;
  const [weakLong, setWeakLong] = useState(false);
  const [offered, setOffered] = useState(false);
  useEffect(() => {
    if (!weak) return;
    const id = setTimeout(() => setWeakLong(true), 20_000);
    return () => {
      clearTimeout(id);
      setWeakLong(false);
    };
  }, [weak]);
  const [talkingMuted, dismissMuted] = useTalkingWhileMuted(
    microphoneTrack?.track as LocalAudioTrack | undefined,
    !isMicrophoneEnabled,
  );

  // The teacher gets a quiet heads-up five minutes before the end.
  const now = useNow();
  const left = info.endsAt.getTime() - now.getTime();
  const [endNoted, setEndNoted] = useState(false);
  const fiveLeft = teacher && !endNoted && left > 0 && left <= 5 * 60_000;

  // People whose connection dropped (not those who left) stay listed until they're back, at most
  // two minutes, so a silent tile isn't mistaken for a silent learner.
  const [dropped, setDropped] = useState<{ identity: string; name: string }[]>([]);
  useEffect(() => {
    const without = (identity: string) => (list: typeof dropped) =>
      list.filter((d) => d.identity !== identity);
    const gone = (p: RemoteParticipant, reason?: DisconnectReason) => {
      if (reason !== undefined && !NETWORK_REASONS.has(reason)) return;
      setDropped((list) => [
        ...without(p.identity)(list),
        { identity: p.identity, name: nameOf(p) },
      ]);
      setTimeout(() => setDropped(without(p.identity)), 120_000);
    };
    const back = (p: RemoteParticipant) => setDropped(without(p.identity));
    room.on(RoomEvent.ParticipantDisconnected, gone);
    room.on(RoomEvent.ParticipantConnected, back);
    return () => {
      room.off(RoomEvent.ParticipantDisconnected, gone);
      room.off(RoomEvent.ParticipantConnected, back);
    };
  }, [room]);

  const goAudioOnly = () => {
    setAudioOnly(true);
    localParticipant.setCameraEnabled(false);
  };
  // The way back is as short as the way out: one tap brings your camera and everyone's video back.
  const goVideo = () => {
    setAudioOnly(false);
    localParticipant.setCameraEnabled(true);
  };

  const notice: NoticeProps | null =
    state === ConnectionState.Connecting
      ? { text: t("notice.connecting"), tone: "info" }
      : state === ConnectionState.Reconnecting || state === ConnectionState.SignalReconnecting
        ? { text: t("notice.reconnecting"), tone: "info" }
        : talkingMuted
          ? {
              text: t("notice.mutedTalking"),
              tone: "turn",
              action: {
                label: t("controls.micOn"),
                onClick: () => localParticipant.setMicrophoneEnabled(true),
              },
              onDismiss: dismissMuted,
            }
          : myTurn
            ? { text: t("notice.myTurn"), tone: "turn" }
            : handUp
              ? { text: t("notice.handUp"), tone: "hand" }
              : weakLong && !audioOnly && !offered
                ? {
                    text: t("notice.weak"),
                    tone: "info",
                    action: {
                      label: t("controls.audioOnly"),
                      onClick: () => {
                        goAudioOnly();
                        setOffered(true);
                      },
                    },
                    onDismiss: () => setOffered(true),
                  }
                : fiveLeft
                  ? { text: t("notice.fiveLeft"), tone: "info", onDismiss: () => setEndNoted(true) }
                  : !teacherHere
                    ? { text: t("notice.noTeacher"), tone: "info" }
                    : audioOnly
                      ? {
                          text: t("notice.audioOnly"),
                          tone: "info",
                          action: { label: t("controls.showVideo"), onClick: goVideo },
                        }
                      : null;

  // Pinned beats a shared screen, which beats the grid. Pins and where your own video sits are
  // yours alone: nobody else's view changes.
  const keyOf = (tr: TrackReferenceOrPlaceholder) => `${tr.participant.identity}-${tr.source}`;
  const pinnedTrack = pinned ? tracks.find((tr) => keyOf(tr) === pinned) : undefined;
  const speaker = others.find((tr) => speaking.includes(tr.participant)) ?? others[0];
  const spotlight = pinnedTrack ?? share ?? (narrow || view === "speaker" ? speaker : undefined);
  // While you present, the big spot holds the "you're presenting" card (see PresentingCard).
  const big = !!spotlight || presenting;
  const selfMode = selfPick !== "auto" ? selfPick : big && !narrow ? "grid" : "float";
  const pinAction = (tr: TrackReferenceOrPlaceholder): TileAction =>
    pinned === keyOf(tr)
      ? { label: t("tile.unpin"), icon: PinOff, onClick: () => setPinned(null) }
      : { label: t("tile.pin"), icon: Pin, onClick: () => setPinned(keyOf(tr)) };
  const selfActions: TileAction[] = self
    ? [
        selfMode === "grid"
          ? { label: t("tile.float"), icon: PictureInPicture2, onClick: () => setSelfMode("float") }
          : { label: t("tile.inGrid"), icon: LayoutGrid, onClick: () => setSelfMode("grid") },
        ...(selfMode === "grid"
          ? []
          : [{ label: t("tile.minimise"), icon: Minimize2, onClick: () => setSelfMode("min") }]),
        pinAction(self),
      ]
    : [];
  const tile = (tr: TrackReferenceOrPlaceholder, size: "large" | "small" = "large") =>
    tr.source === Track.Source.ScreenShare && size === "large" ? (
      <ShareView trackRef={tr} />
    ) : (
      <Tile
        trackRef={tr}
        size={size}
        self={tr.participant.isLocal}
        // A screen comes back by unpinning whoever replaced it, so it needs no menu.
        actions={
          tr.source === Track.Source.ScreenShare
            ? undefined
            : tr.participant.isLocal
              ? selfActions
              : [pinAction(tr)]
        }
      />
    );

  const rest = [selfMode === "grid" ? self : undefined, ...others, share].filter(
    (tr): tr is TrackReferenceOrPlaceholder => !!tr && tr !== spotlight,
  );
  const alone = others.length === 0 && !big;
  const floating = self && spotlight !== self && selfMode !== "grid" && (narrow || !alone) && (
    <FloatingSelf
      narrow={narrow}
      minimised={selfMode === "min"}
      onRestore={() => setSelfMode("float")}
    >
      <Tile trackRef={self} size="pip" self actions={selfActions} />
    </FloatingSelf>
  );
  const overlays = (
    <>
      {floating}
      <ReactionStream
        shown={reactions.shown}
        // The start side: your own video floats at the end.
        className={narrow ? "start-3 bottom-14" : "start-6 bottom-28"}
      />
      {notice && <Notice {...notice} />}
      {dropped.length > 0 && (
        <ul
          aria-live="polite"
          className="absolute start-3 top-16 z-10 flex max-w-[calc(100%-1.5rem)] flex-col items-start gap-1.5"
        >
          {dropped.map((d) => (
            <li
              key={d.identity}
              className="inline-flex items-center gap-2 rounded-pill bg-room-raised px-3 py-1.5 text-sm text-room-ink shadow-[0_8px_24px_rgba(0,0,0,.35)]"
            >
              <Unplug aria-hidden size={16} className="shrink-0 text-room-cinnamon" />
              {t("stage.dropped", { name: d.name })}
            </li>
          ))}
        </ul>
      )}
    </>
  );

  const presentingCard = (
    <PresentingCard
      wholeScreen={wholeScreen}
      canFloat={!narrow && !wholeScreen && !floatWin && floatSupported()}
      onFloat={() => openFloat().catch(() => {})}
      onStop={() => localParticipant.setScreenShareEnabled(false)}
    />
  );
  const stage = narrow ? (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5">
      <div className="relative min-h-0 flex-1">
        {spotlight ? (
          tile(spotlight)
        ) : presenting ? (
          presentingCard
        ) : (
          <Alone text={teacher ? t("stage.aloneTeacher") : t("stage.aloneLearner")} />
        )}
        {overlays}
      </div>
      {rest.length > 0 && (
        <ul aria-label={t("stage.label")} className="flex gap-2 overflow-x-auto">
          {rest.map((tr) => (
            <li key={keyOf(tr)} className="relative h-26 w-21 shrink-0">
              {tile(tr, "small")}
              {/* A tap on a thumbnail puts that person on the big screen (a ⋮ menu is too small a target). */}
              <button
                type="button"
                aria-label={t("tile.pin")}
                onClick={() => setPinned(keyOf(tr))}
                className="absolute inset-0 rounded-[14px]"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  ) : (
    <div
      aria-label={t("stage.label")}
      // With a big tile, the people stand in a column beside it (on the right, like the panel), so
      // a shared screen keeps the full height.
      className={`flex min-h-0 min-w-0 flex-[999_1_640px] gap-3 ${big ? "rtl:flex-row-reverse" : "flex-col"}`}
    >
      <div className="relative min-h-0 min-w-0 flex-1">
        {spotlight ? (
          tile(spotlight)
        ) : presenting ? (
          presentingCard
        ) : alone ? (
          <Alone text={teacher ? t("stage.aloneTeacher") : t("stage.aloneLearner")}>
            {self && (
              <div className="aspect-video w-full max-w-md">
                <Tile trackRef={self} self />
              </div>
            )}
          </Alone>
        ) : (
          <ul ref={grid} className="flex size-full flex-wrap content-center justify-center gap-3">
            {rest.map((tr) => (
              <li key={keyOf(tr)} style={gridTileSize(gridSize, rest.length, 12)}>
                {tile(tr)}
              </li>
            ))}
          </ul>
        )}
        {overlays}
      </div>
      {big && rest.length > 0 && (
        <ul className="flex w-62.5 shrink-0 flex-col gap-3 overflow-y-auto">
          {rest.map((tr) => (
            <li key={keyOf(tr)} className="min-h-32 flex-1 basis-0 overflow-hidden rounded-[20px]">
              {tile(tr, "small")}
            </li>
          ))}
        </ul>
      )}
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
      side={!narrow}
      onClick={() => toggle("visitor")}
    />
  ) : (
    <ControlButton
      icon={Users}
      label={t("controls.people")}
      action={hands ? t("controls.peopleHands", { count: hands }) : t("controls.people")}
      pressed={panel === "people"}
      side={!narrow}
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
      side={!narrow}
      badge={unread ? { text: n(unread), tone: "plain" } : undefined}
      onClick={() => toggle("chat")}
    />
  );
  const reactButton = (
    <ControlButton
      icon={SmilePlus}
      label={t("controls.reactLabel")}
      action={t("controls.react")}
      pressed={reacting}
      onClick={() => setReacting(!reacting)}
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
        if (audioOnly) goVideo();
        else goAudioOnly();
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

  // A phone turned sideways gives a shared screen the whole display.
  if (landscapePhone && share)
    return (
      <div className="fixed inset-0 bg-room">
        <ShareView trackRef={share} />
        <ReactionStream shown={reactions.shown} className="start-3 bottom-3" />
        {notice && <Notice {...notice} />}
      </div>
    );

  return (
    <div className="flex h-dvh flex-col bg-room text-room-ink">
      <TopBar
        info={info}
        count={participants.length}
        narrow={narrow}
        more={narrow ? moreMenu : null}
        view={view}
        onView={setView}
      />

      <main
        id="main"
        // The chat and people panel sits on the right in both languages, as in Meet.
        className={`flex min-h-0 flex-1 gap-4 ${narrow ? "flex-col px-3" : "px-6 pt-4 pb-2 rtl:flex-row-reverse"}`}
      >
        {stage}
        {panelEl}
      </main>

      {reacting && (
        <div className={narrow ? "px-3 pt-2" : "px-6 pt-2"}>
          <ReactionTray onReact={reactions.react} />
        </div>
      )}

      <footer
        aria-label={t("controls.bar")}
        className={`flex gap-x-6 gap-y-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] ${
          narrow
            ? "items-start justify-between px-3 pt-2"
            : "flex-wrap items-center justify-between px-6 pt-3 rtl:flex-row-reverse"
        }`}
      >
        {!narrow && (
          <p className="flex min-w-40 flex-1 items-center gap-2 self-center text-sm whitespace-nowrap text-room-muted rtl:justify-end">
            <b className="font-semibold tabular-nums text-room-ink">
              {elapsedText(now, info.startsAt, locale)}
            </b>
            <span aria-hidden="true" className="h-4 w-px bg-room-line" />
            <span className="truncate">{info.title}</span>
          </p>
        )}
        <div
          className={`flex ${narrow ? "w-full items-start justify-between" : "items-center gap-2.5"}`}
        >
          <MediaButton source={Track.Source.Microphone} />
          <MediaButton
            source={Track.Source.Camera}
            onExitAudioOnly={audioOnly ? goVideo : undefined}
          />
          {teacher && !narrow && <MediaButton source={Track.Source.ScreenShare} />}
          {reactButton}
          {!teacher && handButton}
          {narrow && (teacher ? peopleButton : chatButton)}
          {narrow && teacher && chatButton}
          {!narrow && moreMenu}
          {!narrow && (
            <span aria-hidden="true" className="mx-1 h-9.5 w-px self-center bg-room-line" />
          )}
          {leaveButton}
        </div>
        {!narrow && (
          <div className="flex min-w-40 flex-1 items-center justify-end gap-1.5 rtl:justify-start">
            {peopleButton}
            {chatButton}
          </div>
        )}
      </footer>

      {floatWin && anyShare && (
        <FloatWindow
          win={floatWin}
          preview={anyShare}
          reactions={reactions.shown}
          onReact={reactions.react}
          onStopShare={() => localParticipant.setScreenShareEnabled(false)}
          tracks={[speaker, ...others.filter((tr) => tr !== speaker), self].filter(
            (tr): tr is TrackReferenceOrPlaceholder => !!tr,
          )}
          onBack={() => window.focus()}
          onLeave={() => {
            window.focus();
            setLeaving(true);
          }}
        />
      )}

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

/** Hours:minutes since the class started. */
function elapsedText(now: Date, startsAt: Date, locale: Locale) {
  const minutes = Math.max(0, Math.floor((now.getTime() - startsAt.getTime()) / 60_000));
  return `${formatNumber(Math.floor(minutes / 60), locale)}:${formatNumber(minutes % 60, locale).padStart(2, formatNumber(0, locale))}`;
}

function TopBar({
  info,
  count,
  narrow,
  more,
  view,
  onView,
}: {
  info: ClassroomInfo;
  count: number;
  narrow: boolean;
  more: ReactNode;
  view: "grid" | "speaker";
  onView: (view: "grid" | "speaker") => void;
}) {
  const t = useTranslations("Classroom");
  const locale = useLocale() as Locale;
  const now = useNow();
  const { localParticipant } = useLocalParticipant();
  const { quality } = useConnectionQualityIndicator({ participant: localParticipant });
  const elapsed = elapsedText(now, info.startsAt, locale);
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
        <div
          role="group"
          aria-label={t("header.layout")}
          className="inline-flex h-9 items-center gap-0.5 rounded-pill border border-room-line bg-room-card p-0.5"
        >
          {(
            [
              ["grid", LayoutGrid],
              ["speaker", PanelRight],
            ] as const
          ).map(([name, Icon]) => (
            <button
              key={name}
              type="button"
              aria-pressed={view === name}
              aria-label={t(`header.${name}`)}
              title={t(`header.${name}`)}
              onClick={() => onView(name)}
              className={`grid size-8 place-items-center rounded-pill ${
                view === name
                  ? "bg-room-teal-soft text-room-teal"
                  : "text-room-muted hover:text-room-ink"
              }`}
            >
              <Icon aria-hidden size={16} />
            </button>
          ))}
        </div>
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

type NoticeProps = {
  text: string;
  tone: "info" | "turn" | "hand";
  action?: { label: string; onClick: () => void };
  onDismiss?: () => void;
};

function Notice({ text, tone, action, onDismiss }: NoticeProps) {
  const t = useTranslations("Classroom.notice");
  const Icon = tone === "turn" ? AudioLines : tone === "hand" ? Hand : null;
  return (
    <div
      role="status"
      className={`absolute inset-x-3 top-3 z-10 mx-auto flex max-w-xl flex-wrap items-center gap-2 rounded-[14px] px-3.5 py-2.5 text-sm font-medium shadow-[0_8px_24px_rgba(0,0,0,.35)] ${
        tone === "turn"
          ? "bg-room-teal-soft text-room-teal"
          : tone === "hand"
            ? "bg-room-cinnamon-soft text-room-cinnamon-ink"
            : "bg-room-raised text-room-ink"
      }`}
    >
      {Icon && <Icon aria-hidden size={18} className="shrink-0" />}
      <span className="min-w-0 flex-1">{text}</span>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="min-h-9 shrink-0 rounded-pill bg-room-teal px-3 font-bold text-room"
        >
          {action.label}
        </button>
      )}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="min-h-9 shrink-0 rounded-pill px-2 text-room-muted hover:text-room-ink"
        >
          {t("notNow")}
        </button>
      )}
    </div>
  );
}

/** What you see in the big spot while you present: the shared screen itself would mirror forever. */
function PresentingCard({
  wholeScreen,
  canFloat,
  onFloat,
  onStop,
}: {
  wholeScreen: boolean;
  canFloat: boolean;
  onFloat: () => void;
  onStop: () => void;
}) {
  const t = useTranslations("Classroom");
  return (
    <div
      role="status"
      className="flex size-full min-h-60 flex-col items-center justify-center gap-4 rounded-[20px] border border-room-line bg-room-card p-6 text-center"
    >
      <span className="grid size-16 place-items-center rounded-full bg-room-teal-soft text-room-teal">
        <MonitorUp aria-hidden size={30} />
      </span>
      <p className="text-lg font-bold">{t("stage.presenting")}</p>
      {wholeScreen && floatSupported() && (
        <p className="max-w-sm text-sm text-room-muted">{t("float.wholeScreen")}</p>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        {canFloat && (
          <button
            type="button"
            onClick={onFloat}
            className="min-h-11 rounded-pill border border-room-teal px-5 font-bold text-room-teal"
          >
            {t("float.open")}
          </button>
        )}
        <button
          type="button"
          onClick={onStop}
          className="min-h-11 rounded-pill bg-room-teal px-5 font-bold text-room"
        >
          {t("controls.stopShare")}
        </button>
      </div>
    </div>
  );
}

function Alone({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <div className="flex size-full min-h-60 flex-col items-center justify-center gap-4 rounded-[20px] border border-dashed border-room-line p-6 text-center text-room-muted">
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
  side = false,
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
  /** Chat and people: a quiet round button at the edge of the bar (desktop). */
  side?: boolean;
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
            : side
              ? "bg-transparent text-room-ink group-hover:bg-room-line"
              : "bg-room-raised text-room-ink group-hover:bg-room-line";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={action}
      aria-pressed={pressed}
      title={action}
      className="group relative flex min-w-14 flex-col items-center gap-1.5 rounded-[18px] disabled:opacity-50 md:min-w-0"
    >
      <span
        // From md up the bar is icon-only round buttons (the label stays for screen readers).
        className={`flex h-14 items-center justify-center gap-2 rounded-[18px] transition-colors md:h-12.5 ${
          wide
            ? "px-5 md:rounded-[25px] md:px-5.5"
            : `w-14 md:rounded-full ${side ? "md:size-12" : "md:w-12.5"}`
        } ${square}`}
      >
        <Icon aria-hidden size={24} strokeWidth={tone === "on" ? 2.25 : 2} />
        {wide && <span className="font-bold">{label}</span>}
      </span>
      {!wide && (
        <span
          className={`text-xs md:sr-only ${tone === "off" ? "text-room-danger" : tone === "on" ? "font-bold text-room-cinnamon-ink" : "text-room-muted"}`}
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
  onExitAudioOnly,
}: {
  source: Track.Source.Microphone | Track.Source.Camera | Track.Source.ScreenShare;
  /** Audio-only mode: the camera button brings video back instead of toggling. */
  onExitAudioOnly?: () => void;
}) {
  const t = useTranslations("Classroom.controls");
  const { enabled, pending, toggle } = useTrackToggle({
    source,
    // "detail": on a weak link the browser drops frames, not sharpness, so slide text stays readable.
    captureOptions:
      source === Track.Source.ScreenShare ? { audio: true, contentHint: "detail" } : undefined,
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
  if (onExitAudioOnly)
    return (
      <ControlButton
        icon={VideoOff}
        label={t("cameraOff")}
        action={t("showVideo")}
        tone="off"
        onClick={onExitAudioOnly}
      />
    );
  return (
    <ControlButton
      icon={mic ? (enabled ? Mic : MicOff) : enabled ? Video : VideoOff}
      label={mic ? (enabled ? t("mic") : t("muted")) : enabled ? t("camera") : t("cameraOff")}
      action={mic ? (enabled ? t("micOff") : t("micOn")) : enabled ? t("camOff") : t("camOn")}
      tone={enabled ? "default" : "off"}
      disabled={pending}
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
