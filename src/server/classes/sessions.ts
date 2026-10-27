import { and, asc, eq, gt, gte, inArray, lt, lte, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  attendance,
  attendanceStatusEnum,
  classes,
  classSlots,
  enrollments,
  levelCheckSlots,
  sessionParticipants,
  sessions,
  students,
  teacherLearners,
} from "@/db/schema";
import { fromTehranTime, tehranDateKey } from "@/lib/format";
import { formatClock, parseClock, type Weekday } from "@/lib/schedule";
import type { CefrLevel, ClassState } from "./classes";
import { LEVEL_CHECK_MINUTES } from "../funnel/constants";
import { findClash, isOverlapError, type ClashWith } from "./clash";

export type AttendanceStatus = (typeof attendanceStatusEnum.enumValues)[number];

/**
 * Where a session stands right now:
 * - `upcoming`: hasn't started (can be cancelled)
 * - `live`: on now (Mona can enter the room, then mark it held)
 * - `ended`: over but not confirmed yet
 * - `held` / `cancelled`
 */
export type SessionPhase = "upcoming" | "live" | "ended" | "held" | "cancelled";

export function sessionPhase(
  s: { status: "scheduled" | "held" | "cancelled"; startsAt: Date; endsAt: Date },
  now: Date,
): SessionPhase {
  if (s.status !== "scheduled") return s.status;
  if (now < s.startsAt) return "upcoming";
  return now < s.endsAt ? "live" : "ended";
}

type Person = { id: string; fullNameFa: string; fullNameEn: string | null };

export type SessionRow = {
  id: string;
  /** 1…sessionCount for regular sessions; make-ups have none, so numbers never shift. */
  number: number | null;
  kind: "class" | "makeup";
  startsAt: Date;
  endsAt: Date;
  phase: SessionPhase;
  cancelReason: string | null;
  /** Number of the cancelled session this make-up replaces. */
  replacesNumber: number | null;
  /** Attendance once held. */
  counts: Record<AttendanceStatus, number> | null;
  /** Make-up sessions for some learners only. */
  participants: Person[] | null;
};

export type ClassDetail = {
  id: string;
  nameFa: string;
  nameEn: string | null;
  level: CefrLevel;
  type: "private" | "group";
  capacity: number;
  sessionCount: number;
  sessionMinutes: number;
  startsOn: string;
  priceToman: number;
  description: string | null;
  isPublic: boolean;
  state: ClassState;
  slots: { weekday: Weekday; minutes: number }[];
  sessions: SessionRow[];
  learners: (Person & { status: string; since: Date })[];
  pastLearners: (Person & { since: Date; until: Date })[];
};

export async function getClassDetail(
  teacherId: string,
  id: string,
  now = new Date(),
): Promise<ClassDetail | null> {
  const [cls] = await db
    .select()
    .from(classes)
    .where(and(eq(classes.id, id), eq(classes.teacherId, teacherId)));
  if (!cls) return null;
  const [slotRows, sessionRows, places] = await Promise.all([
    db.select().from(classSlots).where(eq(classSlots.classId, id)).orderBy(asc(classSlots.weekday)),
    db.select().from(sessions).where(eq(sessions.classId, id)).orderBy(asc(sessions.startsAt)),
    db
      .select({
        id: students.id,
        fullNameFa: students.fullNameFa,
        fullNameEn: students.fullNameEn,
        status: teacherLearners.status,
        placeStatus: enrollments.status,
        startedAt: enrollments.startedAt,
        endedAt: enrollments.endedAt,
      })
      .from(enrollments)
      .innerJoin(students, eq(students.id, enrollments.studentId))
      .innerJoin(
        teacherLearners,
        and(
          eq(teacherLearners.studentId, enrollments.studentId),
          eq(teacherLearners.teacherId, teacherId),
        ),
      )
      .where(eq(enrollments.classId, id))
      .orderBy(asc(enrollments.startedAt)),
  ]);
  const ids = sessionRows.map((s) => s.id);
  const [marks, invited] = ids.length
    ? await Promise.all([
        db.select().from(attendance).where(inArray(attendance.sessionId, ids)),
        db
          .select({
            sessionId: sessionParticipants.sessionId,
            id: students.id,
            fullNameFa: students.fullNameFa,
            fullNameEn: students.fullNameEn,
          })
          .from(sessionParticipants)
          .innerJoin(students, eq(students.id, sessionParticipants.studentId))
          .where(inArray(sessionParticipants.sessionId, ids)),
      ])
    : [[], []];

  const numberOf = new Map(
    sessionRows.filter((s) => s.kind === "class").map((s, i) => [s.id, i + 1]),
  );
  const rows: SessionRow[] = sessionRows.map((s) => {
    const mine = marks.filter((m) => m.sessionId === s.id);
    const people = invited.filter((p) => p.sessionId === s.id);
    return {
      id: s.id,
      number: numberOf.get(s.id) ?? null,
      kind: s.kind,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      phase: sessionPhase(s, now),
      cancelReason: s.cancelReason,
      replacesNumber: s.replacesSessionId ? (numberOf.get(s.replacesSessionId) ?? null) : null,
      counts:
        s.status === "held"
          ? {
              present: mine.filter((m) => m.status === "present").length,
              absent: mine.filter((m) => m.status === "absent").length,
              excused: mine.filter((m) => m.status === "excused").length,
            }
          : null,
      participants:
        s.kind === "makeup"
          ? people.map((p) => ({ id: p.id, fullNameFa: p.fullNameFa, fullNameEn: p.fullNameEn }))
          : null,
    };
  });

  const active = places.filter((p) => p.placeStatus === "active");
  const scheduled = sessionRows.filter((s) => s.status === "scheduled").length;
  const state: ClassState = cls.archivedAt
    ? "archived"
    : scheduled === 0
      ? "finished"
      : active.length >= cls.capacity
        ? "full"
        : "open";

  return {
    id: cls.id,
    nameFa: cls.nameFa,
    nameEn: cls.nameEn,
    level: cls.level,
    type: cls.type,
    capacity: cls.capacity,
    sessionCount: cls.sessionCount,
    sessionMinutes: cls.sessionMinutes,
    startsOn: cls.startsOn,
    priceToman: cls.priceToman,
    description: cls.description,
    isPublic: cls.isPublic,
    state,
    slots: slotRows.map((s) => ({
      weekday: s.weekday as Weekday,
      minutes: parseClock(s.startTime.slice(0, 5))!,
    })),
    sessions: rows,
    learners: active.map((p) => ({
      id: p.id,
      fullNameFa: p.fullNameFa,
      fullNameEn: p.fullNameEn,
      status: p.status,
      since: p.startedAt,
    })),
    pastLearners: places
      .filter((p) => p.placeStatus === "ended")
      .map((p) => ({
        id: p.id,
        fullNameFa: p.fullNameFa,
        fullNameEn: p.fullNameEn,
        since: p.startedAt,
        until: p.endedAt!,
      })),
  };
}

/** One of this teacher's sessions. */
const own = (teacherId: string, sessionId: string) =>
  and(eq(sessions.id, sessionId), eq(sessions.teacherId, teacherId));

export const cancelSchema = z.object({
  sessionId: z.uuid(),
  reason: z
    .string()
    .trim()
    .max(200, "reason")
    .transform((v) => v || null),
});

/** The teacher cancels a session that hasn't started. Cancelled sessions are never charged. */
export async function cancelSession(
  teacherId: string,
  sessionId: string,
  reason: string | null,
  now = new Date(),
): Promise<boolean> {
  const [s] = await db.select().from(sessions).where(own(teacherId, sessionId));
  if (!s || sessionPhase(s, now) !== "upcoming") return false;
  const rows = await db
    .update(sessions)
    .set({ status: "cancelled", cancelReason: reason })
    .where(and(eq(sessions.id, sessionId), eq(sessions.status, "scheduled")))
    .returning({ id: sessions.id });
  return rows.length > 0;
}

export const moveSchema = z.object({
  sessionId: z.uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date"),
  time: z.string().transform((v, ctx) => {
    const m = parseClock(v);
    if (m === null) ctx.addIssue({ code: "custom", message: "time" });
    return m ?? 0;
  }),
});

export type MoveInput = z.output<typeof moveSchema>;

export type MoveResult =
  | { ok: true }
  | { ok: false; error: "not_movable" | "past" }
  | { ok: false; error: "clash"; clash: ClashWith | null };

/**
 * Moves one session that hasn't started to a new Tehran day and time, keeping its length. The
 * first scheduled time is kept in `movedFrom` (cleared when it goes back there), so learners and
 * Mona can see it was moved. Hour limits are soft warnings shown before saving, not checked here.
 */
export async function moveSession(
  teacherId: string,
  input: MoveInput,
  now = new Date(),
): Promise<MoveResult> {
  const [s] = await db.select().from(sessions).where(own(teacherId, input.sessionId));
  if (!s || sessionPhase(s, now) !== "upcoming") return { ok: false, error: "not_movable" };
  const startsAt = fromTehranTime(input.date, formatClock(input.time));
  const endsAt = new Date(startsAt.getTime() + (s.endsAt.getTime() - s.startsAt.getTime()));
  if (startsAt <= now) return { ok: false, error: "past" };
  if (startsAt.getTime() === s.startsAt.getTime()) return { ok: true };

  const clash = await findClash(s.teacherId, [{ startsAt, endsAt }], { except: s.id });
  if (clash) return { ok: false, error: "clash", clash };
  const original = s.movedFrom ?? s.startsAt;
  try {
    const rows = await db
      .update(sessions)
      .set({
        startsAt,
        endsAt,
        movedFrom: original.getTime() === startsAt.getTime() ? null : original,
      })
      .where(
        and(
          eq(sessions.id, s.id),
          eq(sessions.status, "scheduled"),
          eq(sessions.startsAt, s.startsAt),
        ),
      )
      .returning({ id: sessions.id });
    return rows.length ? { ok: true } : { ok: false, error: "not_movable" };
  } catch (e) {
    if (isOverlapError(e)) return { ok: false, error: "clash", clash: null };
    throw e;
  }
}

/** Who a session is for: its own list for a make-up, otherwise the class's learners. */
async function participantsOf(s: { id: string; kind: "class" | "makeup"; classId: string }) {
  if (s.kind === "makeup") {
    const rows = await db
      .select({ id: sessionParticipants.studentId })
      .from(sessionParticipants)
      .where(eq(sessionParticipants.sessionId, s.id));
    return rows.map((r) => r.id);
  }
  const rows = await db
    .select({ id: enrollments.studentId })
    .from(enrollments)
    .where(and(eq(enrollments.classId, s.classId), eq(enrollments.status, "active")));
  return rows.map((r) => r.id);
}

export const attendanceSchema = z.object({
  sessionId: z.uuid(),
  marks: z.record(z.uuid(), z.enum(attendanceStatusEnum.enumValues)),
});

/**
 * Confirms a session took place, with everyone's attendance. Present and absent learners are
 * charged; excused ones are not. Only once the session has started, and only once.
 */
export async function markHeld(
  teacherId: string,
  sessionId: string,
  marks: Record<string, AttendanceStatus>,
  now = new Date(),
): Promise<{ ok: true } | { ok: false; error: "not_ready" | "attendance" }> {
  const [s] = await db.select().from(sessions).where(own(teacherId, sessionId));
  if (!s) return { ok: false, error: "not_ready" };
  const phase = sessionPhase(s, now);
  if (phase !== "live" && phase !== "ended") return { ok: false, error: "not_ready" };
  const people = await participantsOf(s);
  if (people.some((id) => !marks[id]) || Object.keys(marks).some((id) => !people.includes(id)))
    return { ok: false, error: "attendance" };

  return db.transaction(async (tx) => {
    const [held] = await tx
      .update(sessions)
      .set({ status: "held", heldAt: now })
      .where(and(eq(sessions.id, sessionId), eq(sessions.status, "scheduled")))
      .returning({ id: sessions.id });
    if (!held) return { ok: false as const, error: "not_ready" as const };
    if (people.length)
      await tx
        .insert(attendance)
        .values(people.map((studentId) => ({ sessionId, studentId, status: marks[studentId] })));
    return { ok: true as const };
  });
}

export const makeupSchema = z.object({
  classId: z.uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date"),
  time: z.string().transform((v, ctx) => {
    const m = parseClock(v);
    if (m === null) ctx.addIssue({ code: "custom", message: "time" });
    return m ?? 0;
  }),
  minutes: z.coerce.number().int().min(15, "minutes").max(240, "minutes"),
  replacesSessionId: z.uuid().optional(),
  studentIds: z.array(z.uuid()).min(1, "studentIds"),
});

export type MakeupInput = z.output<typeof makeupSchema>;

export type MakeupResult =
  | { ok: true; id: string }
  | { ok: false; error: "not_found" | "past" | "learners" | "replaces" }
  | { ok: false; error: "clash"; clash: ClashWith | null };

/** A one-off extra session the teacher schedules, e.g. to replace one they cancelled. */
export async function addMakeup(
  teacherId: string,
  input: MakeupInput,
  now = new Date(),
): Promise<MakeupResult> {
  const [cls] = await db
    .select({ teacherId: classes.teacherId })
    .from(classes)
    .where(and(eq(classes.id, input.classId), eq(classes.teacherId, teacherId)));
  if (!cls) return { ok: false, error: "not_found" };
  const startsAt = fromTehranTime(input.date, formatClock(input.time));
  const endsAt = new Date(startsAt.getTime() + input.minutes * 60_000);
  if (startsAt <= now) return { ok: false, error: "past" };

  const enrolled = await db
    .select({ id: enrollments.studentId })
    .from(enrollments)
    .where(and(eq(enrollments.classId, input.classId), eq(enrollments.status, "active")));
  const allowed = new Set(enrolled.map((e) => e.id));
  if (input.studentIds.some((id) => !allowed.has(id))) return { ok: false, error: "learners" };

  if (input.replacesSessionId) {
    const [replaced] = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(
        and(
          eq(sessions.id, input.replacesSessionId),
          eq(sessions.classId, input.classId),
          eq(sessions.status, "cancelled"),
          // A cancelled session gets one replacement at most.
          sql`not exists (select 1 from ${sessions} m where m.replaces_session_id = ${input.replacesSessionId} and m.status <> 'cancelled')`,
        ),
      );
    if (!replaced) return { ok: false, error: "replaces" };
  }

  const clash = await findClash(cls.teacherId, [{ startsAt, endsAt }]);
  if (clash) return { ok: false, error: "clash", clash };
  try {
    const id = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(sessions)
        .values({
          teacherId: cls.teacherId,
          classId: input.classId,
          kind: "makeup",
          startsAt,
          endsAt,
          replacesSessionId: input.replacesSessionId ?? null,
        })
        .returning({ id: sessions.id });
      await tx
        .insert(sessionParticipants)
        .values(input.studentIds.map((studentId) => ({ sessionId: row.id, studentId })));
      return row.id;
    });
    return { ok: true, id };
  } catch (e) {
    if (isOverlapError(e)) return { ok: false, error: "clash", clash: null };
    throw e;
  }
}

/**
 * The teacher's busy times from now on, for the make-up page's calendar: sessions (not
 * cancelled) and level-check times, in order.
 */
export async function upcomingTeacherSessions(teacherId: string, now = new Date()) {
  const [classRows, slots] = await Promise.all([
    db
      .select({
        nameFa: classes.nameFa,
        nameEn: classes.nameEn,
        startsAt: sessions.startsAt,
        endsAt: sessions.endsAt,
      })
      .from(sessions)
      .innerJoin(classes, eq(classes.id, sessions.classId))
      .where(
        and(
          eq(sessions.teacherId, teacherId),
          ne(sessions.status, "cancelled"),
          gte(sessions.endsAt, now),
        ),
      ),
    db
      .select({ startsAt: levelCheckSlots.startsAt })
      .from(levelCheckSlots)
      .where(
        and(
          eq(levelCheckSlots.teacherId, teacherId),
          gte(levelCheckSlots.startsAt, new Date(now.getTime() - LEVEL_CHECK_MINUTES * 60_000)),
        ),
      ),
  ]);
  return [
    ...classRows.map((r) => ({ kind: "class" as const, ...r })),
    ...slots.map((r) => ({
      kind: "levelCheck" as const,
      startsAt: r.startsAt,
      endsAt: new Date(r.startsAt.getTime() + LEVEL_CHECK_MINUTES * 60_000),
    })),
  ].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

export type DaySession = {
  id: string;
  classId: string;
  nameFa: string;
  nameEn: string | null;
  level: CefrLevel;
  type: "private" | "group";
  kind: "class" | "makeup";
  startsAt: Date;
  endsAt: Date;
  phase: SessionPhase;
  cancelReason: string | null;
  /** Where a moved session was first scheduled. */
  movedFrom: Date | null;
  /** Learners the session is for. */
  people: number;
};

/** The teacher's sessions starting in [from, to), cancelled ones included, in order. */
export async function sessionsBetween(
  teacherId: string,
  from: Date,
  to: Date,
  now = new Date(),
): Promise<DaySession[]> {
  return withPeople(
    await db
      .select(daySessionColumns)
      .from(sessions)
      .innerJoin(classes, eq(classes.id, sessions.classId))
      .where(
        and(
          eq(sessions.teacherId, teacherId),
          gte(sessions.startsAt, from),
          lt(sessions.startsAt, to),
        ),
      )
      .orderBy(asc(sessions.startsAt)),
    now,
  );
}

/** The teacher's sessions on the Tehran day of `now`, cancelled ones included, in order. */
export async function sessionsToday(teacherId: string, now = new Date()): Promise<DaySession[]> {
  const from = fromTehranTime(tehranDateKey(now), "00:00");
  return sessionsBetween(teacherId, from, new Date(from.getTime() + 24 * 60 * 60 * 1000), now);
}

/** Sessions that are over but not marked held yet (any day), oldest first. */
export async function awaitingConfirmation(
  teacherId: string,
  now = new Date(),
): Promise<DaySession[]> {
  return withPeople(
    await db
      .select(daySessionColumns)
      .from(sessions)
      .innerJoin(classes, eq(classes.id, sessions.classId))
      .where(
        and(
          eq(sessions.teacherId, teacherId),
          eq(sessions.status, "scheduled"),
          lte(sessions.endsAt, now),
        ),
      )
      .orderBy(asc(sessions.startsAt)),
    now,
  );
}

const daySessionColumns = {
  id: sessions.id,
  classId: sessions.classId,
  nameFa: classes.nameFa,
  nameEn: classes.nameEn,
  level: classes.level,
  type: classes.type,
  kind: sessions.kind,
  status: sessions.status,
  startsAt: sessions.startsAt,
  endsAt: sessions.endsAt,
  cancelReason: sessions.cancelReason,
  movedFrom: sessions.movedFrom,
};

async function withPeople(
  rows: (Omit<DaySession, "phase" | "people"> & { status: "scheduled" | "held" | "cancelled" })[],
  now: Date,
): Promise<DaySession[]> {
  if (rows.length === 0) return [];
  const classIds = [...new Set(rows.map((r) => r.classId))];
  const makeupIds = rows.filter((r) => r.kind === "makeup").map((r) => r.id);
  const [seats, invited] = await Promise.all([
    db
      .select({ classId: enrollments.classId })
      .from(enrollments)
      .where(and(inArray(enrollments.classId, classIds), eq(enrollments.status, "active"))),
    makeupIds.length
      ? db
          .select({ sessionId: sessionParticipants.sessionId })
          .from(sessionParticipants)
          .where(inArray(sessionParticipants.sessionId, makeupIds))
      : Promise.resolve([]),
  ]);
  return rows.map(({ status, ...r }) => ({
    ...r,
    phase: sessionPhase({ status, startsAt: r.startsAt, endsAt: r.endsAt }, now),
    people:
      r.kind === "makeup"
        ? invited.filter((p) => p.sessionId === r.id).length
        : seats.filter((s) => s.classId === r.classId).length,
  }));
}

/** The class session that's on now or comes next, with who it's for (dashboard's "next class"). */
export async function nextClassSession(teacherId: string, now = new Date()) {
  const [row] = await db
    .select(daySessionColumns)
    .from(sessions)
    .innerJoin(classes, eq(classes.id, sessions.classId))
    .where(
      and(
        eq(sessions.teacherId, teacherId),
        eq(sessions.status, "scheduled"),
        gt(sessions.endsAt, now),
      ),
    )
    .orderBy(asc(sessions.startsAt))
    .limit(1);
  if (!row) return null;
  const [session] = await withPeople([row], now);
  const people =
    row.kind === "makeup"
      ? await db
          .select({ fullNameFa: students.fullNameFa, fullNameEn: students.fullNameEn })
          .from(sessionParticipants)
          .innerJoin(students, eq(students.id, sessionParticipants.studentId))
          .where(eq(sessionParticipants.sessionId, row.id))
      : await db
          .select({ fullNameFa: students.fullNameFa, fullNameEn: students.fullNameEn })
          .from(enrollments)
          .innerJoin(students, eq(students.id, enrollments.studentId))
          .where(and(eq(enrollments.classId, row.classId), eq(enrollments.status, "active")));
  return { ...session, learners: people };
}
