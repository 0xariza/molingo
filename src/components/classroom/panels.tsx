"use client";

import { useChat, useParticipantAttributes } from "@livekit/components-react";
import { Track, type Participant } from "livekit-client";
import {
  AudioLines,
  Ellipsis,
  Mic,
  MicOff,
  SendHorizontal,
  UserMinus,
  UserPlus,
  VideoOff,
  VolumeX,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { Locale } from "@/i18n/routing";
import { formatNumber, formatTime } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { saveLeadNotesAction } from "@/server/funnel/actions";
import type { Visitor } from "@/server/live/level-check";
import {
  muteAction,
  muteAllAction,
  removeAction,
  setTurnAction,
  type ModerationResult,
} from "@/server/live/actions";
import { avatarColor } from "./hooks";
import { isTeacher, nameOf } from "./tile";

/** A side panel on desktop, a bottom sheet on phones. */
function Panel({
  title,
  narrow,
  onClose,
  children,
  footer,
}: {
  title: ReactNode;
  narrow: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const t = useTranslations("Classroom");
  const id = useId();
  const body = (
    <section
      aria-labelledby={id}
      className={`flex min-h-0 flex-col bg-room-card ${
        narrow
          ? "fixed inset-x-0 bottom-0 z-30 h-[78dvh] rounded-t-[22px] pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_40px_rgba(0,0,0,.4)]"
          : "w-full max-w-100 min-w-0 flex-[1_1_340px] rounded-[22px] border border-room-line"
      }`}
    >
      {narrow && (
        <span aria-hidden="true" className="mx-auto mt-2 h-1 w-10 rounded-pill bg-room-control" />
      )}
      <header className="flex items-center justify-between gap-2 border-b border-room-line py-2 ps-5 pe-2">
        <h2
          id={id}
          className="font-sans text-[17px] font-bold tracking-normal normal-case text-room-ink"
        >
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="grid size-11 place-items-center rounded-[12px] text-room-muted hover:bg-room-raised hover:text-room-ink"
        >
          <X aria-hidden size={20} />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      {footer}
    </section>
  );
  if (!narrow) return body;
  return (
    <>
      <div aria-hidden="true" className="fixed inset-0 z-20 bg-[#080b16]/60" onClick={onClose} />
      {body}
    </>
  );
}

/** A dark confirmation dialog on the native <dialog> element. */
export function ConfirmDialog({
  title,
  body,
  cancel,
  confirm,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  cancel: string;
  confirm: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-[22px] border border-room-line bg-room-card p-6 text-room-ink backdrop:bg-[#080b16]/70"
    >
      <h2 id={id} className="font-sans text-xl font-bold tracking-normal normal-case text-room-ink">
        {title}
      </h2>
      <p className="mt-2 text-room-muted">{body}</p>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-12 rounded-[14px] border border-room-control px-5 font-bold hover:bg-room-raised"
        >
          {cancel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="min-h-12 rounded-[14px] bg-room-leave px-5 font-bold text-white hover:brightness-110"
        >
          {confirm}
        </button>
      </div>
    </dialog>
  );
}

type Chat = ReturnType<typeof useChat>;

/** Chat for everyone in the room; messages live only as long as the class (PLAN §6). */
export function ChatPanel({
  chat,
  narrow,
  locale,
  onClose,
}: {
  chat: Chat;
  narrow: boolean;
  locale: Locale;
  onClose: () => void;
}) {
  const t = useTranslations("Classroom");
  const [text, setText] = useState("");
  const end = useRef<HTMLLIElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [chat.chatMessages.length]);

  return (
    <Panel
      title={t("chat.title")}
      narrow={narrow}
      onClose={onClose}
      footer={
        <form
          className="flex gap-2 border-t border-room-line p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) chat.send(text.trim());
            setText("");
          }}
        >
          <input
            aria-label={t("chat.label")}
            placeholder={t("chat.placeholder")}
            value={text}
            dir="auto"
            onChange={(e) => setText(e.target.value)}
            className="h-12 min-w-0 flex-1 rounded-pill border border-room-control bg-room px-4 text-base text-room-ink placeholder:text-room-muted focus-visible:outline-room-teal"
          />
          <button
            type="submit"
            aria-label={t("chat.send")}
            disabled={!text.trim() || chat.isSending}
            className="grid size-12 shrink-0 place-items-center rounded-full bg-room-cinnamon text-room disabled:opacity-50"
          >
            <SendHorizontal aria-hidden size={20} className="rtl:-scale-x-100" />
          </button>
        </form>
      }
    >
      <p className="px-4 pt-3 text-center text-xs text-room-muted">{t("chat.hint")}</p>
      {chat.chatMessages.length === 0 && (
        <p className="px-4 py-8 text-center text-room-muted">{t("chat.empty")}</p>
      )}
      <ol className="flex flex-col gap-3.5 p-4">
        {chat.chatMessages.map((m) => {
          const mine = m.from?.isLocal;
          const who = mine ? t("you") : m.from ? nameOf(m.from) : "";
          return (
            <li key={m.id} className={`flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
              <span className="text-xs text-room-muted">
                {who}
                {m.from && isTeacher(m.from) && !mine ? ` · ${t("teacher")}` : ""}
                {" · "}
                {formatTime(new Date(m.timestamp), locale)}
              </span>
              <span
                dir="auto"
                className={`max-w-[85%] rounded-[14px] px-3 py-2 break-words text-room-ink ${
                  mine ? "rounded-ee-sm bg-room-cinnamon-soft" : "rounded-es-sm bg-room-raised"
                }`}
              >
                {m.message}
              </span>
            </li>
          );
        })}
        <li ref={end} aria-hidden="true" />
      </ol>
    </Panel>
  );
}

/**
 * Everyone in the room. Raised hands come first; Mona can give the turn to speak, turn
 * someone's microphone or camera off, remove them, or mute every learner.
 */
export function PeoplePanel({
  sessionId,
  participants,
  teacher,
  narrow,
  locale,
  onClose,
}: {
  sessionId: string;
  participants: Participant[];
  teacher: boolean;
  narrow: boolean;
  locale: Locale;
  onClose: () => void;
}) {
  const t = useTranslations("Classroom");
  const [error, setError] = useState(false);
  const [removing, setRemoving] = useState<Participant | null>(null);
  const run = (action: Promise<ModerationResult>) =>
    action.then((r) => setError(!r.ok)).catch(() => setError(true));

  const hand = (p: Participant) => p.attributes.hand === "1";
  const rank = (p: Participant) => (p.isLocal ? 0 : isTeacher(p) ? 1 : 2);
  const hands = participants.filter(hand);
  const others = participants.filter((p) => !hand(p)).sort((a, b) => rank(a) - rank(b));
  const n = (v: number) => formatNumber(v, locale);

  return (
    <Panel
      title={
        <>
          {t("people.title")}{" "}
          <span className="font-medium text-room-muted">
            {t("people.count", { count: n(participants.length) })}
          </span>
        </>
      }
      narrow={narrow}
      onClose={onClose}
      footer={
        teacher && participants.some((p) => !isTeacher(p)) ? (
          <div className="border-t border-room-line p-3">
            <button
              type="button"
              onClick={() => run(muteAllAction(sessionId))}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-[14px] border border-room-control font-bold text-room-ink hover:bg-room-raised"
            >
              <VolumeX aria-hidden size={18} />
              {t("people.muteAll")}
            </button>
          </div>
        ) : null
      }
    >
      {error && (
        <p
          role="alert"
          className="m-3 rounded-[12px] bg-room-cinnamon-soft p-3 text-sm text-room-ink"
        >
          {t("errors.failed")}
        </p>
      )}
      <div className="flex flex-col gap-1 p-3">
        {hands.length > 0 && (
          <>
            <h3 className="px-2 pb-1 pt-1 font-sans text-[13px] font-bold tracking-normal normal-case text-room-cinnamon-ink">
              {t("people.hands", { count: n(hands.length) })}
            </h3>
            <ul className="flex flex-col gap-1">
              {hands.map((p) => (
                <Person
                  key={p.identity}
                  p={p}
                  teacher={teacher}
                  sessionId={sessionId}
                  highlight
                  onRun={run}
                  onRemove={setRemoving}
                />
              ))}
            </ul>
          </>
        )}
        <h3 className="px-2 pb-1 pt-3 font-sans text-[13px] font-bold tracking-normal normal-case text-room-muted">
          {t("people.inClass", { count: n(others.length) })}
        </h3>
        <ul className="flex flex-col gap-1">
          {others.map((p) => (
            <Person
              key={p.identity}
              p={p}
              teacher={teacher}
              sessionId={sessionId}
              onRun={run}
              onRemove={setRemoving}
            />
          ))}
        </ul>
      </div>

      {removing && (
        <ConfirmDialog
          title={t("people.removeTitle", { name: nameOf(removing) })}
          body={t("people.removeBody")}
          cancel={t("people.cancel")}
          confirm={t("people.removeConfirm")}
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            run(removeAction(sessionId, removing.identity));
            setRemoving(null);
          }}
        />
      )}
    </Panel>
  );
}

function Person({
  p,
  teacher,
  sessionId,
  highlight = false,
  onRun,
  onRemove,
}: {
  p: Participant;
  teacher: boolean;
  sessionId: string;
  highlight?: boolean;
  onRun: (action: Promise<ModerationResult>) => void;
  onRemove: (p: Participant) => void;
}) {
  const t = useTranslations("Classroom");
  const { attributes } = useParticipantAttributes({ participant: p });
  const [menu, setMenu] = useState(false);
  const mic = p.getTrackPublication(Track.Source.Microphone);
  const micOn = !!mic && !mic.isMuted;
  const camOn = p.isCameraEnabled;
  const turn = attributes?.turn === "1";
  const hand = attributes?.hand === "1";
  const canModerate = teacher && !p.isLocal && !isTeacher(p);
  const status = isTeacher(p)
    ? t("teacher")
    : turn
      ? t("people.hasTurn")
      : hand
        ? t("people.handRaised")
        : t("learner");

  const item =
    "flex min-h-11 w-full items-center gap-2.5 rounded-[10px] px-3 text-start hover:bg-room-raised";

  return (
    <li
      className={`relative flex items-center gap-3 rounded-[14px] px-2.5 py-2 ${highlight ? "bg-room-cinnamon-soft" : ""}`}
    >
      <span
        aria-hidden="true"
        className="grid size-10 shrink-0 place-items-center rounded-full font-bold text-white"
        style={{ background: avatarColor(p.identity) }}
      >
        {nameOf(p).slice(0, 1).toUpperCase()}
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-snug">
        <b className="truncate font-bold text-room-ink">
          {nameOf(p)}{" "}
          {p.isLocal && <span className="font-normal text-room-muted">{t("youSuffix")}</span>}
        </b>
        <small
          className={`text-[13px] ${turn ? "text-room-teal" : hand ? "text-room-cinnamon-ink" : "text-room-muted"}`}
        >
          {status}
        </small>
      </span>
      {highlight && canModerate ? (
        <button
          type="button"
          onClick={() => onRun(setTurnAction(sessionId, p.identity, true))}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[12px] bg-room-teal px-3.5 font-bold text-room"
        >
          <Mic aria-hidden size={16} strokeWidth={2.25} />
          {t("people.giveTurn")}
        </button>
      ) : (
        <span
          role="img"
          aria-label={turn ? t("people.hasTurn") : micOn ? t("people.micOn") : t("people.micOff")}
          className={`grid size-9 shrink-0 place-items-center ${turn ? "text-room-teal" : micOn ? "text-room-ink" : "text-room-danger"}`}
        >
          {turn ? <AudioLines size={20} /> : micOn ? <Mic size={20} /> : <MicOff size={20} />}
        </span>
      )}
      {canModerate && (
        <button
          type="button"
          aria-label={t("people.options", { name: nameOf(p) })}
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
          className={`grid size-11 shrink-0 place-items-center rounded-[12px] ${menu ? "bg-room-line text-room-ink" : "text-room-muted hover:bg-room-raised"}`}
        >
          <Ellipsis aria-hidden size={20} />
        </button>
      )}
      {menu && (
        <div className="absolute end-2.5 top-[calc(100%-4px)] z-10 flex w-56 flex-col rounded-[14px] border border-room-line bg-room-raised p-1.5 shadow-[0_12px_32px_rgba(0,0,0,.5)]">
          <button
            type="button"
            className={item}
            onClick={() => {
              onRun(setTurnAction(sessionId, p.identity, !turn));
              setMenu(false);
            }}
          >
            <Mic aria-hidden size={18} />
            {turn ? t("people.takeTurn") : t("people.giveTurn")}
          </button>
          {micOn && (
            <button
              type="button"
              className={item}
              onClick={() => {
                onRun(muteAction(sessionId, p.identity, "microphone"));
                setMenu(false);
              }}
            >
              <MicOff aria-hidden size={18} />
              {t("people.mute")}
            </button>
          )}
          {camOn && (
            <button
              type="button"
              className={item}
              onClick={() => {
                onRun(muteAction(sessionId, p.identity, "camera"));
                setMenu(false);
              }}
            >
              <VideoOff aria-hidden size={18} />
              {t("people.camera")}
            </button>
          )}
          <span aria-hidden="true" className="mx-2 my-1 h-px bg-room-line" />
          <button
            type="button"
            className={`${item} font-bold text-room-danger`}
            onClick={() => {
              onRemove(p);
              setMenu(false);
            }}
          >
            <UserMinus aria-hidden size={18} />
            {t("people.remove")}
          </button>
        </div>
      )}
    </li>
  );
}

/**
 * Mona's panel in a level check: who the visitor is, her private notes (saved as she types),
 * and "Add as learner", which opens the new-learner form in a new tab so the call goes on.
 */
export function VisitorPanel({
  visitor,
  narrow,
  onClose,
}: {
  visitor: Visitor;
  narrow: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("Classroom.visitor");
  const facts = useTranslations("Admin.schedule.facts");
  const levels = useTranslations("Landing.booking.levels");
  const common = useTranslations("Common");
  const id = useId();
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const save = (notes: string) =>
    saveLeadNotesAction(visitor.leadId, notes)
      .then((ok) => setStatus(ok ? "saved" : "failed"))
      .catch(() => setStatus("failed"));
  const onType = (notes: string) => {
    setStatus("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => save(notes), 800);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  const rows: [string, ReactNode][] = [
    [
      facts("phone"),
      <bdi key="p" dir="ltr">
        {formatPhone(visitor.phone)}
      </bdi>,
    ],
    [facts("level"), levels(visitor.levelGuess)],
    [facts("booking"), facts(visitor.source)],
    [t("siteLanguage"), common(visitor.locale === "fa" ? "persian" : "english")],
  ];

  return (
    <Panel
      title={t("title")}
      narrow={narrow}
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2 border-t border-room-line px-4 pt-3 pb-4">
          <Link
            href={`/admin/students/new?lead=${visitor.leadId}`}
            target="_blank"
            className="flex min-h-12 items-center justify-center gap-2 rounded-[14px] bg-room-cinnamon font-bold text-room"
          >
            <UserPlus aria-hidden size={18} />
            {t("addLearner")}
          </Link>
          <small className="text-center text-[13px] text-room-muted">{t("addHint")}</small>
        </div>
      }
    >
      <div className="flex flex-col gap-5 px-5 py-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-12 shrink-0 place-items-center rounded-full text-xl font-bold text-white"
            style={{ background: avatarColor(visitor.leadId) }}
          >
            {visitor.name.trim().charAt(0)}
          </span>
          <b className="text-[17px]">{visitor.name}</b>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-room-muted">{k}</dt>
              <dd className="font-bold">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-col gap-2">
          <label htmlFor={id} className="font-bold">
            {t("notes")}
          </label>
          <textarea
            id={id}
            rows={7}
            maxLength={2000}
            defaultValue={visitor.notes}
            placeholder={t("notesPlaceholder")}
            onChange={(e) => onType(e.currentTarget.value)}
            className="w-full resize-y rounded-[14px] border border-room-control bg-room px-3.5 py-3 text-room-ink"
          />
          <small aria-live="polite" className="text-[13px] text-room-muted">
            {status === "idle" ? t("notesHint") : t(`notesStatus.${status}`)}
          </small>
        </div>
      </div>
    </Panel>
  );
}
