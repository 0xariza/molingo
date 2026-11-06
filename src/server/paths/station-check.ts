import { and, asc, eq, gt, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  classPaths,
  classPathStations,
  enrollments,
  sessions,
  stationSkills,
  stations,
  studentSkills,
  students,
} from "@/db/schema";
import { reassignSessions } from "./class-paths";

const MAX_SESSIONS = 4;

/** Error keys map to `Admin.afterClass.check.errors`. */
export type CheckError = "not_found" | "not_last" | "max_sessions";

export const checkSchema = z.object({
  sessionId: z.uuid(),
  results: z.array(
    z.object({ studentId: z.uuid(), skillId: z.uuid(), result: z.enum(["ready", "again"]) }),
  ),
  action: z.enum(["close", "hold"]),
});
export type CheckInput = z.output<typeof checkSchema>;

/** The held session this station check belongs to, when it is its station's last session. */
async function lastSessionOf(teacherId: string, sessionId: string) {
  const [s] = await db
    .select({
      classId: sessions.classId,
      startsAt: sessions.startsAt,
      pathStationId: sessions.pathStationId,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.id, sessionId),
        eq(sessions.teacherId, teacherId),
        eq(sessions.status, "held"),
      ),
    );
  if (!s?.pathStationId) return null;
  const [later] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(
      and(
        eq(sessions.pathStationId, s.pathStationId),
        ne(sessions.status, "cancelled"),
        gt(sessions.startsAt, s.startsAt),
      ),
    )
    .limit(1);
  return { ...s, pathStationId: s.pathStationId, last: !later };
}

/** What the station check on a session's after-class page shows; null when it isn't a station's last. */
export async function getStationCheck(teacherId: string, sessionId: string) {
  const s = await lastSessionOf(teacherId, sessionId);
  if (!s?.last) return null;
  const [ps] = await db
    .select({
      stationId: classPathStations.stationId,
      closedAt: classPathStations.closedAt,
      planned: classPathStations.plannedSessions,
    })
    .from(classPathStations)
    .where(eq(classPathStations.id, s.pathStationId));
  if (!ps) return null;
  const [skills, learners] = await Promise.all([
    db
      .select({ id: stationSkills.id, text: stationSkills.text })
      .from(stationSkills)
      .where(eq(stationSkills.stationId, ps.stationId))
      .orderBy(asc(stationSkills.position)),
    db
      .select({ id: students.id, fullNameFa: students.fullNameFa, fullNameEn: students.fullNameEn })
      .from(enrollments)
      .innerJoin(students, eq(students.id, enrollments.studentId))
      .where(and(eq(enrollments.classId, s.classId), eq(enrollments.status, "active")))
      .orderBy(asc(students.fullNameFa)),
  ]);
  const saved = skills.length
    ? await db
        .select({
          studentId: studentSkills.studentId,
          skillId: studentSkills.stationSkillId,
          result: studentSkills.result,
        })
        .from(studentSkills)
        .where(
          inArray(
            studentSkills.stationSkillId,
            skills.map((k) => k.id),
          ),
        )
    : [];
  return {
    closed: ps.closedAt !== null,
    canHold: ps.planned < MAX_SESSIONS,
    skills,
    learners,
    results: saved.filter((r) => learners.some((l) => l.id === r.studentId)),
  };
}

/**
 * Saves the station check: a ready/again per learner and skill, then either closes the station
 * for the class or holds it one more session (later sessions reflow, held ones stay put).
 */
export async function saveStationCheck(
  teacherId: string,
  input: CheckInput,
): Promise<{ ok: true } | { ok: false; error: CheckError }> {
  const s = await lastSessionOf(teacherId, input.sessionId);
  if (!s) return { ok: false, error: "not_found" };
  if (!s.last) return { ok: false, error: "not_last" };
  return db.transaction(async (tx) => {
    const [ps] = await tx
      .select({
        stationId: classPathStations.stationId,
        planned: classPathStations.plannedSessions,
      })
      .from(classPathStations)
      .where(eq(classPathStations.id, s.pathStationId));
    if (!ps) return { ok: false, error: "not_found" } as const;
    if (input.action === "hold" && ps.planned >= MAX_SESSIONS)
      return { ok: false, error: "max_sessions" } as const;
    const [skills, learners] = await Promise.all([
      tx
        .select({ id: stationSkills.id })
        .from(stationSkills)
        .where(eq(stationSkills.stationId, ps.stationId)),
      tx
        .select({ id: enrollments.studentId })
        .from(enrollments)
        .where(and(eq(enrollments.classId, s.classId), eq(enrollments.status, "active"))),
    ]);
    // Trust boundary: only this station's skills and this class's learners count.
    const rows = input.results.filter(
      (r) => skills.some((k) => k.id === r.skillId) && learners.some((l) => l.id === r.studentId),
    );
    if (rows.length)
      await tx
        .insert(studentSkills)
        .values(
          rows.map((r) => ({
            studentId: r.studentId,
            stationSkillId: r.skillId,
            result: r.result,
            sessionId: input.sessionId,
          })),
        )
        .onConflictDoUpdate({
          target: [studentSkills.studentId, studentSkills.stationSkillId],
          set: {
            result: sql`excluded.result`,
            sessionId: sql`excluded.session_id`,
            checkedAt: sql`now()`,
          },
        });
    if (input.action === "close")
      await tx
        .update(classPathStations)
        .set({ closedAt: new Date() })
        .where(eq(classPathStations.id, s.pathStationId));
    else {
      await tx
        .update(classPathStations)
        .set({ plannedSessions: ps.planned + 1 })
        .where(eq(classPathStations.id, s.pathStationId));
      await reassignSessions(tx, s.classId);
    }
    return { ok: true } as const;
  });
}

export type LearnerStation = {
  title: string;
  state: "done" | "current" | "next";
  skills: { id: string; text: string; result: "ready" | "again" | null }[];
};

/** The learner's station map for each class they are in that has a path. */
export async function learnerPaths(userId: string) {
  const [me] = await db
    .select({ id: students.id })
    .from(students)
    .where(eq(students.userId, userId));
  if (!me) return [];
  const paths = await db
    .select({ pathId: classPaths.id, classId: classPaths.classId })
    .from(enrollments)
    .innerJoin(classPaths, eq(classPaths.classId, enrollments.classId))
    .where(and(eq(enrollments.studentId, me.id), eq(enrollments.status, "active")));
  const out: { classId: string; stations: LearnerStation[] }[] = [];
  for (const p of paths) {
    const rows = await db
      .select({
        id: classPathStations.id,
        title: stations.title,
        stationId: stations.id,
        closedAt: classPathStations.closedAt,
      })
      .from(classPathStations)
      .innerJoin(stations, eq(stations.id, classPathStations.stationId))
      .where(and(eq(classPathStations.pathId, p.pathId), eq(classPathStations.included, true)))
      .orderBy(asc(classPathStations.position));
    const skills = rows.length
      ? await db
          .select({
            id: stationSkills.id,
            stationId: stationSkills.stationId,
            text: stationSkills.text,
            result: studentSkills.result,
          })
          .from(stationSkills)
          .leftJoin(
            studentSkills,
            and(
              eq(studentSkills.stationSkillId, stationSkills.id),
              eq(studentSkills.studentId, me.id),
            ),
          )
          .where(
            inArray(
              stationSkills.stationId,
              rows.map((r) => r.stationId),
            ),
          )
          .orderBy(asc(stationSkills.position))
      : [];
    const current = rows.findIndex((r) => !r.closedAt);
    out.push({
      classId: p.classId,
      stations: rows.map((r, i) => ({
        title: r.title,
        state: r.closedAt ? "done" : i === current ? "current" : "next",
        skills: skills
          .filter((k) => k.stationId === r.stationId)
          .map((k) => ({ id: k.id, text: k.text, result: k.result })),
      })),
    });
  }
  return out;
}
