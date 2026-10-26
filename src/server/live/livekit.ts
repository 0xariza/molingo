import "server-only";
import { AccessToken, RoomServiceClient, TrackSource } from "livekit-server-sdk";
import { roomName, type RoomInfo } from "./room";

/**
 * LiveKit settings. `LIVEKIT_URL` is what browsers connect to (wss://lk.hoopo.ir);
 * `LIVEKIT_HTTP` is how this server reaches LiveKit's API (loopback in production).
 */
function config() {
  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!url || !apiKey || !apiSecret) throw new Error("LIVEKIT_URL and its API key are not set");
  const http = process.env.LIVEKIT_HTTP ?? url.replace(/^ws/, "http");
  return { url, http, apiKey, apiSecret };
}

const roomService = () => {
  const { http, apiKey, apiSecret } = config();
  return new RoomServiceClient(http, apiKey, apiSecret);
};

/** Places beyond the class's own: Mona, plus one spare for a reconnecting device. */
const SPARE_PLACES = 2;

/**
 * A join token for one person (PLAN §1 join flow). Learners may publish camera and microphone;
 * Mona may also share her screen and moderate. Everyone may set their own attributes (raise hand).
 */
export async function joinToken(
  userId: string,
  info: Pick<RoomInfo, "room" | "name" | "role" | "closesAt">,
  now = new Date(),
) {
  const { apiKey, apiSecret } = config();
  const token = new AccessToken(apiKey, apiSecret, {
    identity: userId,
    name: info.name,
    attributes: { role: info.role },
    ttl: Math.max(60, Math.round((info.closesAt.getTime() - now.getTime()) / 1000)),
  });
  token.addGrant({
    room: info.room,
    roomJoin: true,
    canSubscribe: true,
    canPublish: true,
    canPublishData: true,
    canUpdateOwnMetadata: true,
    canPublishSources:
      info.role === "teacher"
        ? [
            TrackSource.CAMERA,
            TrackSource.MICROPHONE,
            TrackSource.SCREEN_SHARE,
            TrackSource.SCREEN_SHARE_AUDIO,
          ]
        : [TrackSource.CAMERA, TrackSource.MICROPHONE],
    roomAdmin: info.role === "teacher",
  });
  return token.toJwt();
}

/** Creates the room if it doesn't exist yet (idempotent), sized for its learners. */
export async function ensureRoom(room: string, capacity: number) {
  await roomService().createRoom({
    name: room,
    maxParticipants: capacity + SPARE_PLACES,
    emptyTimeout: 600,
  });
}

export const liveKitUrl = () => config().url;

export const muteTrack = (sessionId: string, identity: string, trackSid: string) =>
  roomService().mutePublishedTrack(roomName(sessionId), identity, trackSid, true);

export async function removeFromRoom(sessionId: string, identity: string) {
  try {
    await roomService().removeParticipant(roomName(sessionId), identity);
  } catch (error) {
    // Already gone (left or dropped): the removal record still keeps them out.
    if ((error as { status?: number }).status !== 404) throw error;
  }
}

export const setAttributes = (
  sessionId: string,
  identity: string,
  attributes: Record<string, string>,
) => roomService().updateParticipant(roomName(sessionId), identity, { attributes });

/** Who is in the room now, with their live microphone and camera tracks and the turn. */
export async function roomParticipants(sessionId: string) {
  const list = await roomService().listParticipants(roomName(sessionId));
  const live = (p: (typeof list)[number], source: TrackSource) =>
    p.tracks.find((t) => t.source === source && !t.muted)?.sid ?? null;
  return list.map((p) => ({
    identity: p.identity,
    role: p.attributes.role,
    turn: p.attributes.turn === "1",
    micSid: live(p, TrackSource.MICROPHONE),
    cameraSid: live(p, TrackSource.CAMERA),
  }));
}
