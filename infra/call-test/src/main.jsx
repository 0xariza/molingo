// M6 classroom prototype, Meet/Zoom-style: LiveKit's room, tracks and hooks, our own tiles and
// round control bar in Persian. Adds raise hand, the teacher's moderation (give turn, mute,
// remove, mute everyone), chat, waiting-for-Mona and leave confirmation.
import "./theme.css";
import {
  LiveKitRoom,
  ParticipantTile,
  PreJoin,
  RoomAudioRenderer,
  StartAudio,
  VideoTrack,
  isTrackReference,
  useChat,
  useConnectionState,
  useIsMuted,
  useIsSpeaking,
  useLocalParticipant,
  useParticipantAttributes,
  useParticipants,
  useRoomContext,
  useTrackToggle,
  useTracks,
} from "@livekit/components-react";
import { ConnectionState, RoomEvent, Track, VideoPresets } from "livekit-client";
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ICONS } from "./icons.js";

const fa = (n) => n.toLocaleString("fa-IR");
const TITLE = "کلاس آزمایشی";

function report(event, extra) {
  const body = JSON.stringify({ event, ...extra });
  if (!navigator.sendBeacon?.("api/report", new Blob([body], { type: "application/json" })))
    fetch("api/report", {
      method: "POST",
      body,
      keepalive: true,
      headers: { "Content-Type": "application/json" },
    });
}

async function moderate(password, body) {
  const res = await fetch("api/moderate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password, ...body }),
  });
  if (!res.ok) throw new Error(`moderate ${res.status}`);
}

const Icon = ({ name, size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
    <path d={ICONS[name]} />
  </svg>
);

/** A steady avatar colour per person, like Meet's initials. */
const AVATAR = ["#13609b", "#8a5cc2", "#1d7a4c", "#b4532a", "#a0347a", "#3e6a9e"];
const avatarColor = (id) =>
  AVATAR[[...id].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR.length];
const nameOf = (p) => p.name || p.identity;
const isTeacher = (p) => p.attributes?.role === "teacher";

function useNarrow() {
  const query = "(max-width: 760px)";
  const [narrow, setNarrow] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const m = matchMedia(query);
    const on = () => setNarrow(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return narrow;
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);
  return now.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
}

function App() {
  const [session, setSession] = useState(null);
  if (!session) return <Join onJoined={setSession} />;
  return (
    <LiveKitRoom
      serverUrl={session.url}
      token={session.token}
      connect
      audio={session.choices.audioEnabled ? { deviceId: session.choices.audioDeviceId } : false}
      video={
        session.choices.videoEnabled
          ? { deviceId: session.choices.videoDeviceId, resolution: VideoPresets.h360.resolution }
          : false
      }
      options={{ adaptiveStream: true, dynacast: true, publishDefaults: { simulcast: true } }}
      data-lk-theme="default"
      className="mo-root"
      onDisconnected={() => setSession(null)}
    >
      <Classroom session={session} />
      <RoomAudioRenderer />
      <StartAudio label="برای شنیدن صدای کلاس بزن" />
    </LiveKitRoom>
  );
}

function Join({ onJoined }) {
  const [password, setPassword] = useState("");
  const [network, setNetwork] = useState("");
  const [vpn, setVpn] = useState(false);
  const [error, setError] = useState("");

  async function submit(choices) {
    setError("");
    if (!password) return setError("رمز آزمایش را بنویس.");
    if (!network) return setError("اینترنتت را انتخاب کن.");
    try {
      const res = await fetch("api/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: choices.username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "ورود نشد.");
      onJoined({ ...data, choices, password, name: choices.username, network, vpn });
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <main className="mo-join" data-lk-theme="default">
      <section className="mo-join-preview" aria-label="پیش‌نمایش دوربین">
        <PreJoin
          onSubmit={submit}
          joinLabel="ورود به کلاس"
          micLabel="میکروفون"
          camLabel="دوربین"
          userLabel="اسمت"
          persistUserChoices
        />
      </section>
      <section className="mo-join-side">
        <h1>آماده‌ای وارد شوی؟</h1>
        <p>دوربین و میکروفونت را امتحان کن. برای صدای بهتر VPN را خاموش کن.</p>
        <label className="mo-field">
          رمز آزمایش
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        <label className="mo-field">
          اینترنتت
          <select value={network} onChange={(e) => setNetwork(e.target.value)}>
            <option value="">انتخاب کن</option>
            <option>همراه اول</option>
            <option>ایرانسل</option>
            <option>رایتل</option>
            <option>فیبر خانگی</option>
            <option>ADSL خانگی</option>
            <option>وای‌فای محل کار</option>
            <option>دیگر</option>
          </select>
        </label>
        <label className="mo-check">
          <input type="checkbox" checked={vpn} onChange={(e) => setVpn(e.target.checked)} /> VPN
          روشن است
        </label>
        {error && (
          <p className="mo-error" role="alert">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}

/** One person's tile: video (or a coloured initial), name, mic-off badge, hand and turn marks. */
function Tile({ trackRef, self = false, contain = false }) {
  const p = trackRef.participant;
  const camMuted = useIsMuted(trackRef);
  const micMuted = useIsMuted({ participant: p, source: Track.Source.Microphone });
  const speaking = useIsSpeaking(p);
  const { attributes } = useParticipantAttributes({ participant: p });
  const hand = attributes?.hand === "1";
  const turn = attributes?.turn === "1";
  const showVideo = isTrackReference(trackRef) && !camMuted;
  const isShare = trackRef.source === Track.Source.ScreenShare;
  const classes = [
    "mo-tile",
    speaking && !micMuted && "mo-speaking",
    turn && "mo-turn",
    self && "mo-self",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <ParticipantTile trackRef={trackRef} className={classes} disableSpeakingIndicator>
      {showVideo ? (
        <VideoTrack trackRef={trackRef} style={{ objectFit: contain ? "contain" : "cover" }} />
      ) : (
        <div className="mo-avatar-wrap">
          <span className="mo-avatar" style={{ background: avatarColor(p.identity) }}>
            {nameOf(p).slice(0, 1).toUpperCase()}
          </span>
        </div>
      )}
      <span className="mo-tile-name">
        {hand && <Icon name="hand" size={16} />}
        {self ? "تو" : nameOf(p)}
        {isShare ? " (صفحه)" : isTeacher(p) && !self ? " · معلم" : ""}
      </span>
      {!isShare && micMuted && (
        <span className="mo-tile-mic" role="img" aria-label="میکروفون خاموش">
          <Icon name="micOff" size={16} />
        </span>
      )}
      {turn && <span className="mo-tile-turn">نوبت</span>}
    </ParticipantTile>
  );
}

/** A round toggle for the microphone, camera or screen share; red when off, like Meet. */
function MediaButton({ source, on, off, onIcon, offIcon, invert = false }) {
  const { enabled, toggle, pending } = useTrackToggle({
    source,
    captureOptions: source === Track.Source.ScreenShare ? { audio: true } : undefined,
  });
  const bad = invert ? false : !enabled;
  return (
    <button
      type="button"
      className={`mo-round${bad ? " mo-off" : ""}${invert && enabled ? " mo-on" : ""}`}
      aria-pressed={enabled}
      aria-label={enabled ? on : off}
      title={enabled ? on : off}
      disabled={pending}
      onClick={() => toggle()}
    >
      <Icon name={enabled ? onIcon : offIcon} />
    </button>
  );
}

function Classroom({ session }) {
  const teacher = session.role === "teacher";
  const room = useRoomContext();
  const narrow = useNarrow();
  const clock = useClock();
  const state = useConnectionState();
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const { attributes: mine } = useParticipantAttributes({ participant: localParticipant });
  const [panel, setPanel] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const chat = useChat();
  const seen = useRef(0);
  const reconnects = useRef(0);
  const joinedAt = useRef(Date.now());

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  const self = tracks.find((t) => t.participant.isLocal && t.source === Track.Source.Camera);
  const share = tracks.find((t) => isTrackReference(t) && t.source === Track.Source.ScreenShare);
  // The teacher first, then raised hands, then everyone else in joining order.
  const rank = (t) =>
    isTeacher(t.participant) ? 0 : t.participant.attributes?.hand === "1" ? 1 : 2;
  const others = tracks
    .filter((t) => !t.participant.isLocal && t.source === Track.Source.Camera)
    .sort((a, b) => rank(a) - rank(b));
  const teacherHere = participants.some((p) => isTeacher(p) && !p.isLocal) || teacher;

  if (panel === "chat") seen.current = chat.chatMessages.length;
  const unread = chat.chatMessages.length - seen.current;
  const hands = participants.filter((p) => p.attributes?.hand === "1").length;
  const handUp = mine?.hand === "1";
  const myTurn = mine?.turn === "1";

  useEffect(() => {
    const base = {
      name: session.name,
      role: session.role,
      network: session.network,
      vpn: session.vpn,
    };
    report("joined", base);
    const onReconnecting = () => {
      reconnects.current++;
      report("reconnecting", base);
    };
    room.on(RoomEvent.Reconnecting, onReconnecting);
    const leave = () =>
      report("left", {
        ...base,
        seconds: Math.round((Date.now() - joinedAt.current) / 1000),
        reconnects: reconnects.current,
      });
    window.addEventListener("pagehide", leave);
    return () => {
      room.off(RoomEvent.Reconnecting, onReconnecting);
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, [room, session]);

  const toggle = (name) => setPanel((p) => (p === name ? null : name));
  const notice =
    state === ConnectionState.Connecting
      ? "در حال وصل شدن…"
      : state === ConnectionState.Reconnecting || state === ConnectionState.SignalReconnecting
        ? "اتصال قطع شد؛ در حال وصل شدن دوباره…"
        : myTurn
          ? "نوبت توست! مونا منتظر شنیدن صدایت است."
          : !teacherHere
            ? "مونا هنوز نیامده. همین‌جا بمان."
            : null;

  const stage = share ? (
    <div className="mo-stage mo-has-share">
      <div className="mo-share">
        <Tile trackRef={share} contain />
      </div>
      <div className="mo-strip">
        {others.map((t) => (
          <Tile key={t.participant.identity} trackRef={t} />
        ))}
      </div>
    </div>
  ) : (
    <div className="mo-stage">
      {others.length === 0 ? (
        <div className="mo-alone">
          {self && <Tile trackRef={self} self />}
          <p>
            {teacher
              ? "هنوز کسی نیامده. زبان‌آموزها که وارد شوند، اینجا دیده می‌شوند."
              : "فقط تو داخل کلاسی."}
          </p>
        </div>
      ) : (
        <div className="mo-grid" data-count={Math.min(others.length, 6)}>
          {others.map((t) => (
            <Tile key={t.participant.identity} trackRef={t} />
          ))}
        </div>
      )}
    </div>
  );

  const people = (
    <button
      type="button"
      className="mo-round mo-quiet"
      aria-pressed={panel === "people"}
      aria-label="افراد"
      title="افراد"
      onClick={() => toggle("people")}
    >
      <Icon name="people" />
      {hands > 0 && <span className="mo-badge mo-badge-hand">{fa(hands)}</span>}
    </button>
  );
  const chatButton = (
    <button
      type="button"
      className="mo-round mo-quiet"
      aria-pressed={panel === "chat"}
      aria-label="گفتگو"
      title="گفتگو"
      onClick={() => toggle("chat")}
    >
      <Icon name="chat" />
      {unread > 0 && <span className="mo-badge">{fa(unread)}</span>}
    </button>
  );
  const handButton = (
    <button
      type="button"
      className={`mo-round${handUp ? " mo-on" : ""}`}
      aria-pressed={handUp}
      aria-label={handUp ? "پایین آوردن دست" : "بالا بردن دست"}
      title={handUp ? "پایین آوردن دست" : "بالا بردن دست"}
      onClick={() => localParticipant.setAttributes({ hand: handUp ? "" : "1" })}
    >
      <Icon name="hand" />
    </button>
  );

  return (
    <div className="mo-room">
      {notice && (
        <p className={`mo-notice${myTurn ? " mo-notice-turn" : ""}`} role="status">
          {notice}
        </p>
      )}
      <div className="mo-body">
        {stage}
        {self && others.length > 0 && !share && (
          <div className="mo-pip">
            <Tile trackRef={self} self />
          </div>
        )}
        {panel === "chat" && <ChatPanel chat={chat} onClose={() => setPanel(null)} />}
        {panel === "people" && (
          <PeoplePanel
            participants={participants}
            teacher={teacher}
            password={session.password}
            onClose={() => setPanel(null)}
          />
        )}
      </div>

      <footer className="mo-bar" aria-label="کنترل‌های کلاس">
        {!narrow && (
          <div className="mo-bar-meta">
            <span>{clock}</span>
            <span aria-hidden="true">|</span>
            <b>{TITLE}</b>
          </div>
        )}
        <div className="mo-bar-main">
          <MediaButton
            source={Track.Source.Microphone}
            on="خاموش کردن میکروفون"
            off="روشن کردن میکروفون"
            onIcon="mic"
            offIcon="micOff"
          />
          <MediaButton
            source={Track.Source.Camera}
            on="خاموش کردن دوربین"
            off="روشن کردن دوربین"
            onIcon="cam"
            offIcon="camOff"
          />
          {teacher && !narrow && (
            <MediaButton
              source={Track.Source.ScreenShare}
              on="توقف اشتراک صفحه"
              off="اشتراک صفحه"
              onIcon="share"
              offIcon="share"
              invert
            />
          )}
          {!teacher && handButton}
          {narrow && teacher && people}
          {narrow && chatButton}
          <button
            type="button"
            className="mo-hangup"
            aria-label="خروج از کلاس"
            title="خروج از کلاس"
            onClick={() => setLeaving(true)}
          >
            <Icon name="hangUp" />
          </button>
        </div>
        {!narrow && (
          <div className="mo-bar-end">
            {people}
            {chatButton}
          </div>
        )}
      </footer>

      {leaving && (
        <div className="mo-sheet-backdrop" onClick={() => setLeaving(false)}>
          <section
            className="mo-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="leave-title">از کلاس خارج می‌شوی؟</h2>
            <p>کلاس ادامه دارد و می‌توانی دوباره وارد شوی.</p>
            <div className="mo-sheet-actions">
              <button
                type="button"
                className="mo-btn mo-btn-quiet"
                onClick={() => setLeaving(false)}
              >
                در کلاس می‌مانم
              </button>
              <button
                type="button"
                className="mo-btn mo-btn-danger"
                onClick={() => room.disconnect()}
              >
                خروج
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Panel({ title, onClose, children, footer }) {
  return (
    <aside className="mo-panel" aria-label={title}>
      <header>
        <h2>{title}</h2>
        <button type="button" className="mo-icon-btn" aria-label="بستن" onClick={onClose}>
          <Icon name="close" size={22} />
        </button>
      </header>
      <div className="mo-panel-body">{children}</div>
      {footer}
    </aside>
  );
}

function ChatPanel({ chat, onClose }) {
  const [text, setText] = useState("");
  const end = useRef(null);
  // A block body: scrollIntoView() may return a Promise, which React would take as a cleanup.
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [chat.chatMessages.length]);
  return (
    <Panel
      title="گفتگوی کلاس"
      onClose={onClose}
      footer={
        <form
          className="mo-send"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) chat.send(text.trim());
            setText("");
          }}
        >
          <input
            aria-label="پیام"
            placeholder="پیام برای همه"
            value={text}
            onChange={(e) => setText(e.target.value)}
            dir="auto"
          />
          <button
            type="submit"
            className="mo-icon-btn mo-send-btn"
            aria-label="فرستادن"
            disabled={!text.trim() || chat.isSending}
          >
            <Icon name="send" size={22} />
          </button>
        </form>
      }
    >
      <p className="mo-hint">پیام‌ها فقط تا پایان کلاس می‌مانند.</p>
      <ol className="mo-messages">
        {chat.chatMessages.map((m) => (
          <li key={m.id}>
            <b>
              {m.from?.isLocal ? "تو" : m.from?.name || m.from?.identity}{" "}
              <small>
                {new Date(m.timestamp).toLocaleTimeString("fa-IR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </small>
            </b>
            <span dir="auto">{m.message}</span>
          </li>
        ))}
        <li ref={end} aria-hidden="true" />
      </ol>
    </Panel>
  );
}

function PeoplePanel({ participants, teacher, password, onClose }) {
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState(null);
  const act = (body) =>
    moderate(password, body).catch(() => setError("انجام نشد. دوباره امتحان کن."));
  const learners = participants.filter((p) => !isTeacher(p));
  const rank = (p) => (p.isLocal ? 0 : isTeacher(p) ? 1 : p.attributes?.hand === "1" ? 2 : 3);
  const sorted = [...participants].sort((a, b) => rank(a) - rank(b));
  const muteAll = () =>
    learners.forEach((p) => {
      const mic = p.getTrackPublication(Track.Source.Microphone);
      if (mic && !mic.isMuted)
        act({ action: "mute", identity: p.identity, trackSid: mic.trackSid });
    });
  return (
    <Panel
      title={`افراد (${fa(participants.length)})`}
      onClose={onClose}
      footer={
        teacher && learners.length > 0 ? (
          <div className="mo-send">
            <button
              type="button"
              className="mo-btn mo-btn-quiet"
              style={{ flex: 1 }}
              onClick={muteAll}
            >
              بی‌صدا کردن همه
            </button>
          </div>
        ) : null
      }
    >
      {error && (
        <p className="mo-error" role="alert">
          {error}
        </p>
      )}
      <ul className="mo-people">
        {sorted.map((p) => {
          const mic = p.getTrackPublication(Track.Source.Microphone);
          const micOn = mic && !mic.isMuted;
          const hand = p.attributes?.hand === "1";
          const canModerate = teacher && !p.isLocal && !isTeacher(p);
          return (
            <li key={p.identity}>
              <span
                className="mo-avatar mo-avatar-sm"
                style={{ background: avatarColor(p.identity) }}
              >
                {nameOf(p).slice(0, 1).toUpperCase()}
              </span>
              <span className="mo-person-text">
                <b>
                  {nameOf(p)}
                  {p.isLocal ? " (تو)" : ""}
                </b>
                <small>
                  {isTeacher(p)
                    ? "معلم"
                    : hand
                      ? "دستش بالاست"
                      : p.attributes?.turn === "1"
                        ? "نوبت اوست"
                        : "زبان‌آموز"}
                </small>
              </span>
              {hand && canModerate && (
                <button
                  type="button"
                  className="mo-btn mo-btn-turn"
                  onClick={() =>
                    act({
                      action: "giveTurn",
                      identity: p.identity,
                      others: learners.map((l) => l.identity),
                    })
                  }
                >
                  نوبت بده
                </button>
              )}
              <span
                className={`mo-mic-state${micOn ? "" : " off"}`}
                role="img"
                aria-label={micOn ? "میکروفون روشن" : "میکروفون خاموش"}
              >
                <Icon name={micOn ? "mic" : "micOff"} size={20} />
              </span>
              {canModerate && micOn && (
                <button
                  type="button"
                  className="mo-btn mo-btn-quiet"
                  onClick={() =>
                    act({ action: "mute", identity: p.identity, trackSid: mic.trackSid })
                  }
                >
                  بی‌صدا
                </button>
              )}
              {canModerate && (
                <button
                  type="button"
                  className="mo-btn mo-btn-quiet"
                  onClick={() => setRemoving(p)}
                >
                  بیرون
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {removing && (
        <div className="mo-sheet-backdrop" onClick={() => setRemoving(null)}>
          <section
            className="mo-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="remove-title">{nameOf(removing)} را از کلاس بیرون می‌بری؟</h2>
            <p>از این جلسه بیرون می‌رود.</p>
            <div className="mo-sheet-actions">
              <button
                type="button"
                className="mo-btn mo-btn-quiet"
                onClick={() => setRemoving(null)}
              >
                منصرف شدم
              </button>
              <button
                type="button"
                className="mo-btn mo-btn-danger"
                onClick={() => {
                  act({ action: "remove", identity: removing.identity });
                  setRemoving(null);
                }}
              >
                بیرون بردن
              </button>
            </div>
          </section>
        </div>
      )}
    </Panel>
  );
}

createRoot(document.getElementById("root")).render(<App />);
