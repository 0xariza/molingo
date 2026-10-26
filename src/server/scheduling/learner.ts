import { and, asc, eq, gte, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { classes, enrollments, sessionParticipants, sessions, students } from "@/db/schema";
import { fromTehranTime, tehranDateKey } from "@/lib/format";
import { addDays } from "@/lib/schedule";
import type { CefrLevel } from "../classes/classes";
import { sessionPhase, type SessionPhase } from "../classes/sessions";
import { windowError } from "../live/room";

/** How far ahead a learner's schedule looks. */
export const LEARNER_SCHEDULE_DAYS = 14;

export type LearnerSession = {
  id: string;
  nameFa: string;
  nameEn: string | null;
  level: CefrLevel;
  type: "private" | "group";
  kind: "class" | "makeup";
  /** Regular sessions only: its place in the course, and the course length. */
  number: number | null;
  sessionCount: number;
  startsAt: Date;
  endsAt: Date;
  phase: SessionPhase;
  /** The room is open to learners now (5 min before until the end). */
  canJoin: boolean;
  cancelReason: string | null;
  movedFrom: Date | null;
};

/**
 * A learner's sessions from the start of today (Tehran) for two weeks, cancelled ones included:
 * their classes' regular sessions while they hold a place, and make-ups they're invited to.
 */
export async function learnerSchedule(userId: string, now = new Date()): Promise<LearnerSession[]> {
  const today = tehranDateKey(now);
  const from = fromTehranTime(today, "00:00");
  const to = fromTehranTime(addDays(today, LEARNER_SCHEDULE_DAYS), "00:00");
  const rows = await db
    .select({
      id: sessions.id,
      nameFa: classes.nameFa,
      nameEn: classes.nameEn,
      level: classes.level,
      type: classes.type,
      kind: sessions.kind,
      number: sql<number | null>`case when ${sessions.kind} = 'class' then (
        select count(*)::int from ${sessions} n
        where n.class_id = ${sessions.classId} and n.kind = 'class' and n.starts_at <= ${sessions.startsAt}
      ) end`,
      sessionCount: classes.sessionCount,
      status: sessions.status,
      startsAt: sessions.startsAt,
      endsAt: sessions.endsAt,
      cancelReason: sessions.cancelReason,
      movedFrom: sessions.movedFrom,
    })
    .from(sessions)
    .innerJoin(classes, eq(classes.id, sessions.classId))
    .innerJoin(students, eq(students.userId, userId))
    .where(
      and(
        gte(sessions.startsAt, from),
        lt(sessions.startsAt, to),
        or(
          and(
            eq(sessions.kind, "class"),
            sql`exists (select 1 from ${enrollments} e where e.class_id = ${sessions.classId} and e.student_id = ${students.id} and e.status = 'active')`,
          ),
          and(
            eq(sessions.kind, "makeup"),
            sql`exists (select 1 from ${sessionParticipants} p where p.session_id = ${sessions.id} and p.student_id = ${students.id})`,
          ),
        ),
      ),
    )
    .orderBy(asc(sessions.startsAt));
  return rows.map(({ status, ...r }) => ({
    ...r,
    phase: sessionPhase({ status, startsAt: r.startsAt, endsAt: r.endsAt }, now),
    canJoin:
      windowError("student", { status, startsAt: r.startsAt, endsAt: r.endsAt }, now) === null,
  }));
}
