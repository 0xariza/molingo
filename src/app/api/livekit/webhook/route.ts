import { recordRoomEvent } from "@/server/live/attendance";
import { receiveWebhook } from "@/server/live/livekit";
import { sessionIdOfRoom } from "@/server/live/room";

const UUID = /^[0-9a-f-]{36}$/i;
const EVENTS = { participant_joined: "joined", participant_left: "left" } as const;

/** LiveKit's room events: joins and leaves of class rooms become attendance events. */
export async function POST(request: Request) {
  let event;
  try {
    event = await receiveWebhook(await request.text(), request.headers.get("authorization") ?? "");
  } catch {
    return new Response(null, { status: 401 });
  }
  const kind = EVENTS[event.event as keyof typeof EVENTS];
  const sessionId = sessionIdOfRoom(event.room?.name ?? "");
  const userId = event.participant?.identity;
  if (kind && sessionId && userId && UUID.test(userId)) {
    await recordRoomEvent({
      sessionId,
      userId,
      event: kind,
      at: new Date(Number(event.createdAt) * 1000),
      livekitEventId: event.id,
    });
  }
  return new Response(null, { status: 200 });
}
