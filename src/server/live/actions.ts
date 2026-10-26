"use server";

import { z } from "zod";
import { requireAdmin, requireUser } from "../auth/current";
import {
  ensureRoom,
  joinToken,
  liveKitUrl,
  muteTrack,
  removeFromRoom,
  roomParticipants,
  setAttributes,
} from "./livekit";
import { recordRemoval, roomFor, type RoomError } from "./room";

/** Error keys map to messages under `Classroom.errors`. */
export type LiveError = RoomError | "unavailable" | "failed";
export type JoinResult =
  { ok: true; url: string; token: string; identity: string } | { ok: false; error: LiveError };
export type ModerationResult = { ok: true } | { ok: false; error: LiveError };

const sessionId = z.uuid();
const identity = z.uuid();

/** A LiveKit token for this session's room, if the join rule (PLAN §4) lets this user in now. */
export async function joinRoomAction(id: string): Promise<JoinResult> {
  const user = await requireUser();
  const parsed = sessionId.safeParse(id);
  if (!parsed.success) return { ok: false, error: "notFound" };
  const access = await roomFor(user, parsed.data);
  if (!access.ok) return { ok: false, error: access.error };
  try {
    await ensureRoom(parsed.data, access.room.capacity);
    return {
      ok: true,
      url: liveKitUrl(),
      token: await joinToken(user.id, access.room),
      identity: user.id,
    };
  } catch (error) {
    console.error("LiveKit join failed", error);
    return { ok: false, error: "unavailable" };
  }
}

/** Mona's moderation runs only while she may be in that room herself. */
async function moderate(
  id: string,
  run: (session: string) => Promise<unknown>,
): Promise<ModerationResult> {
  const admin = await requireAdmin();
  const parsed = sessionId.safeParse(id);
  if (!parsed.success) return { ok: false, error: "notFound" };
  const access = await roomFor(admin, parsed.data);
  if (!access.ok) return { ok: false, error: access.error };
  try {
    await run(parsed.data);
    return { ok: true };
  } catch (error) {
    console.error("LiveKit moderation failed", error);
    return { ok: false, error: "failed" };
  }
}

const sources = z.enum(["microphone", "camera"]);

/** Turns off someone's microphone or camera. They can turn it back on themselves. */
export async function muteAction(id: string, who: string, source: "microphone" | "camera") {
  const target = identity.safeParse(who);
  const kind = sources.safeParse(source);
  if (!target.success || !kind.success) return { ok: false, error: "failed" } as const;
  return moderate(id, async (session) => {
    const [person] = (await roomParticipants(session)).filter((p) => p.identity === target.data);
    const sid = kind.data === "microphone" ? person?.micSid : person?.cameraSid;
    if (sid) await muteTrack(session, target.data, sid);
  });
}

/** Turns off every learner's microphone. */
export async function muteAllAction(id: string) {
  return moderate(id, async (session) => {
    const learners = (await roomParticipants(session)).filter((p) => p.role !== "teacher");
    await Promise.all(
      learners.flatMap((p) => (p.micSid ? [muteTrack(session, p.identity, p.micSid)] : [])),
    );
  });
}

/** Removes a learner from the room for the rest of this session. */
export async function removeAction(id: string, who: string) {
  const target = identity.safeParse(who);
  if (!target.success) return { ok: false, error: "failed" } as const;
  return moderate(id, async (session) => {
    await recordRemoval(session, target.data);
    await removeFromRoom(session, target.data);
  });
}

/**
 * Gives a learner the turn to speak (and lowers their hand), or takes it back. Only one learner
 * holds the turn at a time.
 */
export async function setTurnAction(id: string, who: string, on: boolean) {
  const target = identity.safeParse(who);
  if (!target.success) return { ok: false, error: "failed" } as const;
  return moderate(id, async (session) => {
    if (on) {
      const others = (await roomParticipants(session)).filter(
        (p) => p.identity !== target.data && p.turn,
      );
      await Promise.all(others.map((p) => setAttributes(session, p.identity, { turn: "" })));
    }
    await setAttributes(session, target.data, on ? { hand: "", turn: "1" } : { turn: "" });
  });
}
