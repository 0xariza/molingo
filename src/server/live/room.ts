import { and, asc, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import {
  classes,
  enrollments,
  sessionParticipants,
  sessionRemovals,
  sessions,
  students,
  teachers,
} from "@/db/schema";
import type { CefrLevel } from "../classes/classes";
import type { SessionUser } from "../auth/sessions";
import { isStudent, isTeacher } from "../auth/policy";

/** How early each side may enter, and how long Mona may stay after the end. */
export const LEARNER_EARLY_MINUTES = 5;
export const TEACHER_EARLY_MINUTES = 60;
export const TEACHER_LATE_MINUTES = 30;

const MINUTE = 60_000;

export type RoomRole = "teacher" | "student";

/** Error keys map to messages under `Classroom.errors`. */
export type RoomError = "notFound" | "closed" | "tooEarly" | "ended" | "removed";

export type RoomInfo = {
  sessionId: string;
  classId: string;
  /** LiveKit room name. */
  room: string;
  role: RoomRole;
  /** Who the others see: Mona's display name, a learner's first name only. */
  name: string;
  nameFa: string;
  nameEn: string | null;
  level: CefrLevel;
  kind: "class" | "makeup";
  /** The class's places (the room holds these plus Mona). */
  capacity: number;
  startsAt: Date;
  endsAt: Date;
  /** When the room shuts for this person (the token expires then). */
  closesAt: Date;
};

export const roomName = (sessionId: string) => `s_${sessionId}`;

/** When this side may be in the room: learners from 5 min before to the end, Mona wider. */
export function roomWindow(role: RoomRole, s: { startsAt: Date; endsAt: Date }) {
  return role === "teacher"
    ? {
        opensAt: new Date(s.startsAt.getTime() - TEACHER_EARLY_MINUTES * MINUTE),
        closesAt: new Date(s.endsAt.getTime() + TEACHER_LATE_MINUTES * MINUTE),
      }
    : {
        opensAt: new Date(s.startsAt.getTime() - LEARNER_EARLY_MINUTES * MINUTE),
        closesAt: s.endsAt,
      };
}

/** The window rule alone: only a scheduled session opens, and only inside the window. */
export function windowError(
  role: RoomRole,
  s: { status: "scheduled" | "held" | "cancelled"; startsAt: Date; endsAt: Date },
  now: Date,
): RoomError | null {
  if (s.status !== "scheduled") return "closed";
  const { opensAt, closesAt } = roomWindow(role, s);
  if (now < opensAt) return "tooEarly";
  if (now > closesAt) return "ended";
  return null;
}

/** First word of a name: classmates see each other's first names only. */
export const firstName = (full: string) => full.trim().split(/\s+/)[0] ?? full;

/**
 * Whether this user may be in this session's room now (PLAN §4 room-join rule). The teacher may
 * enter their own sessions; a learner needs an active place in the class (regular sessions) or an
 * invitation (make-ups), and must not have been removed from it.
 */
export async function roomFor(
  user: SessionUser,
  sessionId: string,
  now = new Date(),
): Promise<
  | { ok: true; room: RoomInfo }
  | { ok: false; error: RoomError; /** With `tooEarly`. */ opensAt?: Date }
> {
  const role: RoomRole | null = isTeacher(user.role)
    ? "teacher"
    : isStudent(user.role)
      ? "student"
      : null;
  if (!role || !/^[0-9a-f-]{36}$/i.test(sessionId)) return { ok: false, error: "notFound" };

  const [s] = await db
    .select({
      status: sessions.status,
      kind: sessions.kind,
      startsAt: sessions.startsAt,
      endsAt: sessions.endsAt,
      classId: sessions.classId,
      nameFa: classes.nameFa,
      nameEn: classes.nameEn,
      level: classes.level,
      capacity: classes.capacity,
      teacherUserId: teachers.userId,
    })
    .from(sessions)
    .innerJoin(classes, eq(classes.id, sessions.classId))
    .innerJoin(teachers, eq(teachers.id, sessions.teacherId))
    .where(eq(sessions.id, sessionId));
  if (!s || (role === "teacher" && s.teacherUserId !== user.id))
    return { ok: false, error: "notFound" };

  let name = user.displayName;
  if (role === "student") {
    const [learner] = await db
      .select({ id: students.id, fullNameFa: students.fullNameFa })
      .from(students)
      .where(eq(students.userId, user.id));
    const [place] = !learner
      ? []
      : s.kind === "class"
        ? await db
            .select({ id: enrollments.id })
            .from(enrollments)
            .where(
              and(
                eq(enrollments.classId, s.classId),
                eq(enrollments.studentId, learner.id),
                eq(enrollments.status, "active"),
              ),
            )
        : await db
            .select({ id: sessionParticipants.studentId })
            .from(sessionParticipants)
            .where(
              and(
                eq(sessionParticipants.sessionId, sessionId),
                eq(sessionParticipants.studentId, learner.id),
              ),
            );
    if (!learner || !place) return { ok: false, error: "notFound" };
    name = firstName(learner.fullNameFa);

    const [removed] = await db
      .select({ at: sessionRemovals.removedAt })
      .from(sessionRemovals)
      .where(and(eq(sessionRemovals.sessionId, sessionId), eq(sessionRemovals.userId, user.id)));
    if (removed) return { ok: false, error: "removed" };
  }

  const error = windowError(role, s, now);
  if (error === "tooEarly") return { ok: false, error, opensAt: roomWindow(role, s).opensAt };
  if (error) return { ok: false, error };
  return {
    ok: true,
    room: {
      sessionId,
      classId: s.classId,
      room: roomName(sessionId),
      role,
      name,
      nameFa: s.nameFa,
      nameEn: s.nameEn,
      level: s.level,
      kind: s.kind,
      capacity: s.capacity,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      closesAt: roomWindow(role, s).closesAt,
    },
  };
}

/** Where a class's share link (`/j/<classId>`) goes: its current or next regular session. */
export async function shareLinkSession(classId: string, now = new Date()) {
  if (!/^[0-9a-f-]{36}$/i.test(classId)) return null;
  const [s] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(
      and(
        eq(sessions.classId, classId),
        eq(sessions.kind, "class"),
        eq(sessions.status, "scheduled"),
        gt(sessions.endsAt, now),
      ),
    )
    .orderBy(asc(sessions.startsAt))
    .limit(1);
  return s?.id ?? null;
}

/** Mona removed someone: their next token for this session is refused. */
export async function recordRemoval(sessionId: string, userId: string) {
  await db.insert(sessionRemovals).values({ sessionId, userId }).onConflictDoNothing();
}
