import { and, asc, eq, gt, lt, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { classes, levelCheckSlots, sessions } from "@/db/schema";
import { LEVEL_CHECK_MINUTES } from "../funnel/constants";

/** What a new time collides with: one of Mona's sessions, or a level-check time she opened. */
export type ClashWith =
  | { kind: "class"; nameFa: string; nameEn: string | null; startsAt: Date }
  | { kind: "levelCheck"; startsAt: Date };

type Span = { startsAt: Date; endsAt: Date };

/**
 * The earliest of the teacher's sessions (not cancelled) or level-check times (open or booked)
 * that overlaps any of these times. `except` leaves out a session being moved.
 */
export async function findClash(
  teacherId: string,
  times: Span[],
  { except }: { except?: string } = {},
): Promise<ClashWith | null> {
  if (times.length === 0) return null;
  const length = LEVEL_CHECK_MINUTES * 60_000;
  const [session, slot] = await Promise.all([
    db
      .select({ nameFa: classes.nameFa, nameEn: classes.nameEn, startsAt: sessions.startsAt })
      .from(sessions)
      .innerJoin(classes, eq(classes.id, sessions.classId))
      .where(
        and(
          eq(sessions.teacherId, teacherId),
          ne(sessions.status, "cancelled"),
          except ? ne(sessions.id, except) : undefined,
          or(
            ...times.map((t) =>
              and(lt(sessions.startsAt, t.endsAt), gt(sessions.endsAt, t.startsAt)),
            ),
          ),
        ),
      )
      .orderBy(asc(sessions.startsAt))
      .limit(1)
      .then(([row]) => row),
    db
      .select({ startsAt: levelCheckSlots.startsAt })
      .from(levelCheckSlots)
      .where(
        or(
          ...times.map((t) =>
            and(
              lt(levelCheckSlots.startsAt, t.endsAt),
              gt(levelCheckSlots.startsAt, new Date(t.startsAt.getTime() - length)),
            ),
          ),
        ),
      )
      .orderBy(asc(levelCheckSlots.startsAt))
      .limit(1)
      .then(([row]) => row),
  ]);
  if (session && (!slot || session.startsAt <= slot.startsAt)) return { kind: "class", ...session };
  return slot ? { kind: "levelCheck", startsAt: slot.startsAt } : null;
}

/** The `sessions_no_overlap` exclusion constraint refused a write (a race the check above lost). */
export function isOverlapError(e: unknown): boolean {
  const err = e as { code?: string; cause?: { code?: string } };
  return (err.code ?? err.cause?.code) === "23P01";
}
