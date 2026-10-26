import { eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { leads, levelCheckSlots } from "@/db/schema";
import { hashToken } from "../auth/crypto";
import { LEVEL_CHECK_MINUTES } from "../funnel/constants";
import { firstName, roomWindow, type RoomError, type RoomRole } from "./room";

/** The visitor may come in this long before the time starts. */
export const VISITOR_EARLY_MINUTES = 10;

const MINUTE = 60_000;

export type LevelCheckRoom = {
  slotId: string;
  /** LiveKit room name. */
  room: string;
  role: RoomRole;
  /** The visitor's LiveKit identity: fixed, so a second device takes over from the first. */
  visitorIdentity: string;
  name: string;
  startsAt: Date;
  endsAt: Date;
  closesAt: Date;
};

export type LevelCheckAccess =
  | { ok: true; room: LevelCheckRoom }
  | { ok: false; error: RoomError; /** With `tooEarly`. */ opensAt?: Date };

const endOf = (startsAt: Date) => new Date(startsAt.getTime() + LEVEL_CHECK_MINUTES * MINUTE);

/** The visitor: from 10 min before until the slot ends. Mona: her usual wider window. */
export function levelCheckWindow(role: RoomRole, startsAt: Date) {
  const endsAt = endOf(startsAt);
  return role === "teacher"
    ? roomWindow("teacher", { startsAt, endsAt })
    : { opensAt: new Date(startsAt.getTime() - VISITOR_EARLY_MINUTES * MINUTE), closesAt: endsAt };
}

/** Only booked times match: the inner join drops free ones. */
async function access(role: RoomRole, where: SQL, now: Date): Promise<LevelCheckAccess> {
  const [slot] = await db
    .select({
      id: levelCheckSlots.id,
      startsAt: levelCheckSlots.startsAt,
      leadId: leads.id,
      name: leads.name,
    })
    .from(levelCheckSlots)
    .innerJoin(leads, eq(leads.id, levelCheckSlots.leadId))
    .where(where);
  if (!slot) return { ok: false, error: "notFound" };
  const { opensAt, closesAt } = levelCheckWindow(role, slot.startsAt);
  if (now < opensAt) return { ok: false, error: "tooEarly", opensAt };
  if (now > closesAt) return { ok: false, error: "ended" };
  return {
    ok: true,
    room: {
      slotId: slot.id,
      room: `l_${slot.id}`,
      role,
      visitorIdentity: `lead_${slot.leadId}`,
      name: firstName(slot.name),
      startsAt: slot.startsAt,
      endsAt: endOf(slot.startsAt),
      closesAt,
    },
  };
}

/**
 * The visitor's way in, with no login: the secret code from their link. A cancelled booking or a
 * newer link leaves no matching hash, so the old code finds nothing.
 */
export function visitorLevelCheck(code: string, now = new Date()) {
  if (!/^[\w-]{43}$/.test(code)) return Promise.resolve({ ok: false, error: "notFound" } as const);
  return access("student", eq(levelCheckSlots.joinCodeHash, hashToken(code)), now);
}

/** Mona's way in to a booked time. The caller has checked she is the admin. */
export function teacherLevelCheck(slotId: string, now = new Date()) {
  if (!/^[0-9a-f-]{36}$/i.test(slotId))
    return Promise.resolve({ ok: false, error: "notFound" } as const);
  return access("teacher", eq(levelCheckSlots.id, slotId), now);
}
