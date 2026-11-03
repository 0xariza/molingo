import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { attendanceEvents } from "@/db/schema";

export type RoomEvent = { event: "joined" | "left"; at: Date };

/**
 * Seconds one person spent in the room inside `[from, to]`, summing every visit so reconnects
 * add up. A second join without a leave and a leave without a join are ignored; a visit still
 * open at `to` counts until `to`.
 */
export function secondsInRoom(events: RoomEvent[], from: Date, to: Date): number {
  let total = 0;
  let joinedAt: Date | null = null;
  const add = (start: Date, end: Date) => {
    const s = Math.max(start.getTime(), from.getTime());
    const e = Math.min(end.getTime(), to.getTime());
    if (e > s) total += (e - s) / 1000;
  };
  for (const e of [...events].sort((a, b) => a.at.getTime() - b.at.getTime())) {
    if (e.event === "joined") joinedAt ??= e.at;
    else if (joinedAt) {
      add(joinedAt, e.at);
      joinedAt = null;
    }
  }
  if (joinedAt) add(joinedAt, to);
  return Math.round(total);
}

export async function recordRoomEvent(e: {
  sessionId: string;
  userId: string;
  event: "joined" | "left";
  at: Date;
  livekitEventId: string;
}) {
  await db.insert(attendanceEvents).values(e).onConflictDoNothing();
}

/** Whole minutes each person spent in a session's room, by user id. */
export async function minutesInRoom(session: { id: string; startsAt: Date; endsAt: Date }) {
  const rows = await db
    .select()
    .from(attendanceEvents)
    .where(eq(attendanceEvents.sessionId, session.id))
    .orderBy(asc(attendanceEvents.at));
  const byUser = new Map<string, RoomEvent[]>();
  for (const r of rows) byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r]);
  return new Map(
    [...byUser].map(([userId, events]) => [
      userId,
      Math.round(secondsInRoom(events, session.startsAt, session.endsAt) / 60),
    ]),
  );
}
