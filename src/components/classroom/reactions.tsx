"use client";

import { useDataChannel } from "@livekit/components-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { nameOf } from "./tile";

const REACTIONS = {
  like: "👍",
  clap: "👏",
  heart: "❤️",
  laugh: "😂",
  wow: "😮",
  think: "🤔",
} as const;
type ReactionKey = keyof typeof REACTIONS;
type Shown = { id: number; key: ReactionKey; name: string };

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const isReaction = (key: string): key is ReactionKey => Object.hasOwn(REACTIONS, key);

/** Reactions sent to everyone in the room; each one shows for a few seconds with its sender. */
export function useReactions(you: string) {
  const [shown, setShown] = useState<Shown[]>([]);
  const next = useRef(0);
  const show = (key: ReactionKey, name: string) => {
    const id = next.current++;
    setShown((list) => [...list.slice(-5), { id, key, name }]);
    setTimeout(() => setShown((list) => list.filter((r) => r.id !== id)), 4000);
  };
  const { send } = useDataChannel("reaction", (msg) => {
    // Anyone in the room can send anything on this topic: show only the six known reactions.
    const key = decoder.decode(msg.payload);
    if (isReaction(key)) show(key, msg.from ? nameOf(msg.from) : "");
  });
  const react = (key: ReactionKey) => {
    send(encoder.encode(key), { reliable: false }).catch(() => {});
    show(key, you);
  };
  return { shown, react };
}

/** The row of reactions to pick from. */
export function ReactionTray({ onReact }: { onReact: (key: ReactionKey) => void }) {
  const t = useTranslations("Classroom.reactions");
  return (
    <div
      role="group"
      aria-label={t("label")}
      className="mx-auto flex w-fit max-w-full gap-1 rounded-pill bg-room-raised p-1.5 shadow-[0_8px_24px_rgba(0,0,0,.4)]"
    >
      {(Object.keys(REACTIONS) as ReactionKey[]).map((key) => (
        <button
          key={key}
          type="button"
          aria-label={t(key)}
          title={t(key)}
          onClick={() => onReact(key)}
          className="grid size-12 place-items-center rounded-full text-[26px] hover:bg-room-line active:scale-90"
        >
          <span aria-hidden="true">{REACTIONS[key]}</span>
        </button>
      ))}
    </div>
  );
}

/** Reactions floating up over the stage. */
export function ReactionStream({ shown, className }: { shown: Shown[]; className: string }) {
  const t = useTranslations("Classroom.reactions");
  return (
    <ul
      aria-live="polite"
      aria-label={t("label")}
      className={`pointer-events-none absolute z-10 flex flex-col items-start gap-1.5 ${className}`}
    >
      {shown.map((r) => (
        <li
          key={r.id}
          className="inline-flex items-center gap-1.5 rounded-pill bg-room-card/90 py-0.5 ps-1 pe-3 text-sm text-room-ink motion-safe:animate-[float-up_4s_ease-out_forwards]"
        >
          <span aria-hidden="true" className="text-2xl">
            {REACTIONS[r.key]}
          </span>
          <span className="sr-only">{t(r.key)}</span>
          {r.name}
        </li>
      ))}
    </ul>
  );
}
