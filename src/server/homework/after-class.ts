import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  assignmentRecipients,
  assignments,
  classPathStations,
  sessionSkills,
  sessions,
  stationSkills,
  submissions,
} from "@/db/schema";
import { getClassDetail } from "../classes/sessions";
import { getClassPath } from "../paths/class-paths";
import { assignmentFilesOf, type StoredFile } from "./submissions";

import { homeworkIssue, type HomeworkIssue } from "./issues";
import type { HomeworkType } from "./types";

export type SessionHomework = {
  id: string;
  type: HomeworkType;
  title: string;
  body: string | null;
  dueAt: Date | null;
  files: StoredFile[];
  /** Student ids it went to; `all` when that was every active learner at the time. */
  recipientIds: string[];
  all: boolean;
  skillId: string | null;
  handedIn: number;
  /** False for a draft. */
  published: boolean;
  issue: HomeworkIssue | null;
};

export type AfterClass = {
  sessionId: string;
  classId: string;
  nameFa: string;
  nameEn: string | null;
  number: number | null;
  sessionCount: number;
  startsAt: Date;
  endsAt: Date;
  present: number;
  topics: string[];
  summary: string | null;
  privateNote: string | null;
  /** The station this session taught, when the class has a path. */
  station: {
    title: string;
    /** 1-based among the path's stations. */
    position: number;
    /** This session's place within the station, e.g. 2 of 3. */
    sessionInStation: number;
    of: number;
    skills: { id: string; text: string; worked: boolean }[];
  } | null;
  learners: { id: string; fullNameFa: string; fullNameEn: string | null }[];
  /** When the class next meets: the default deadline is an hour before. */
  nextStartsAt: Date | null;
  homework: SessionHomework[];
  /** When the page was last sent; null while it is a draft or changed since. */
  sentAt: Date | null;
};

/** Topics are kept one per line in `sessions.topics`. */
export const splitTopics = (topics: string | null) =>
  (topics ?? "")
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);

/** The after-class page of one held session; null when it isn't Mona's or isn't held. */
export async function getAfterClass(
  teacherId: string,
  sessionId: string,
  now = new Date(),
): Promise<AfterClass | null> {
  const [row] = await db
    .select({
      classId: sessions.classId,
      status: sessions.status,
      pathStationId: sessions.pathStationId,
      sentAt: sessions.afterClassSentAt,
    })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.teacherId, teacherId)));
  if (!row || row.status !== "held") return null;
  const [cls, path] = await Promise.all([
    getClassDetail(teacherId, row.classId, now),
    getClassPath(teacherId, row.classId),
  ]);
  if (!cls) return null;
  const s = cls.sessions.find((x) => x.id === sessionId)!;

  let station: AfterClass["station"] = null;
  if (path && row.pathStationId) {
    const [ps] = await db
      .select({ stationId: classPathStations.stationId })
      .from(classPathStations)
      .where(eq(classPathStations.id, row.pathStationId));
    const included = path.stations.filter((x) => x.included);
    const info = included.find((x) => x.pathStationId === row.pathStationId);
    if (ps && info) {
      const [inStation, skills, worked] = await Promise.all([
        db
          .select({ id: sessions.id })
          .from(sessions)
          .where(eq(sessions.pathStationId, row.pathStationId))
          .orderBy(asc(sessions.startsAt)),
        db
          .select({ id: stationSkills.id, text: stationSkills.text })
          .from(stationSkills)
          .where(eq(stationSkills.stationId, ps.stationId))
          .orderBy(asc(stationSkills.position)),
        db
          .select({ id: sessionSkills.stationSkillId })
          .from(sessionSkills)
          .where(eq(sessionSkills.sessionId, sessionId)),
      ]);
      station = {
        title: info.title,
        position: included.indexOf(info) + 1,
        sessionInStation: inStation.findIndex((x) => x.id === sessionId) + 1,
        of: info.plannedSessions,
        skills: skills.map((k) => ({ ...k, worked: worked.some((w) => w.id === k.id) })),
      };
    }
  }

  const items = await db
    .select({
      id: assignments.id,
      type: assignments.type,
      title: assignments.title,
      body: assignments.body,
      dueAt: assignments.dueAt,
      skillId: assignments.stationSkillId,
      publishedAt: assignments.publishedAt,
      handedIn: sql<number>`(select count(*)::int from ${submissions} s where s.assignment_id = "assignments"."id")`,
    })
    .from(assignments)
    .where(and(eq(assignments.sessionId, sessionId), eq(assignments.teacherId, teacherId)))
    .orderBy(asc(assignments.createdAt));
  const ids = items.map((i) => i.id);
  const [fileMap, recipients] = await Promise.all([
    assignmentFilesOf(ids),
    ids.length
      ? db
          .select({
            id: assignmentRecipients.assignmentId,
            studentId: assignmentRecipients.studentId,
          })
          .from(assignmentRecipients)
          .where(inArray(assignmentRecipients.assignmentId, ids))
      : Promise.resolve([]),
  ]);
  const active = cls.learners.filter((l) => l.status === "active");
  return {
    sessionId,
    classId: cls.id,
    nameFa: cls.nameFa,
    nameEn: cls.nameEn,
    number: s.number,
    sessionCount: cls.sessionCount,
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    present: s.counts?.present ?? 0,
    topics: splitTopics(s.topics),
    summary: s.summary,
    privateNote: s.privateNote,
    station,
    learners: active.map(({ id, fullNameFa, fullNameEn }) => ({ id, fullNameFa, fullNameEn })),
    sentAt: row.sentAt,
    nextStartsAt:
      cls.sessions.find((x) => x.phase === "upcoming" && x.startsAt > now)?.startsAt ?? null,
    homework: items.map((i) => {
      const to = recipients.filter((r) => r.id === i.id).map((r) => r.studentId);
      return {
        ...i,
        files: fileMap.get(i.id) ?? [],
        recipientIds: to,
        all: active.every((l) => to.includes(l.id)),
        published: i.publishedAt !== null,
        issue: homeworkIssue(
          i.type,
          i.body,
          (fileMap.get(i.id) ?? []).map((f) => f.mime),
        ),
      };
    }),
  };
}

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "tooLong")
    .transform((v) => v || null);

export const coveredSchema = z.object({
  sessionId: z.uuid(),
  topics: z
    .array(z.string().trim().min(1).max(80, "tooLong"))
    .max(12, "tooLong")
    .transform((list) => [...new Set(list)].join("\n") || null),
  summary: text(2000),
  privateNote: text(2000),
  skillIds: z.array(z.uuid()).max(4),
});
export type CoveredInput = z.output<typeof coveredSchema>;

/** Saves what a held session covered: topics, summary, private note and the skills worked on. */
export async function saveCovered(teacherId: string, input: CoveredInput): Promise<boolean> {
  const { sessionId, skillIds, ...log } = input;
  return db.transaction(async (tx) => {
    const [saved] = await tx
      .update(sessions)
      .set({ ...log, afterClassSentAt: null })
      .where(
        and(
          eq(sessions.id, sessionId),
          eq(sessions.teacherId, teacherId),
          eq(sessions.status, "held"),
        ),
      )
      .returning({ pathStationId: sessions.pathStationId });
    if (!saved) return false;
    // Only skills of the session's own station count.
    const allowed = saved.pathStationId
      ? await tx
          .select({ id: stationSkills.id })
          .from(stationSkills)
          .innerJoin(classPathStations, eq(classPathStations.stationId, stationSkills.stationId))
          .where(eq(classPathStations.id, saved.pathStationId))
      : [];
    const keep = skillIds.filter((id) => allowed.some((a) => a.id === id));
    await tx.delete(sessionSkills).where(eq(sessionSkills.sessionId, sessionId));
    if (keep.length)
      await tx
        .insert(sessionSkills)
        .values(keep.map((stationSkillId) => ({ sessionId, stationSkillId })));
    return true;
  });
}

/**
 * "Save and send": publishes every draft item of the session and marks the page sent, which also
 * shows the topics to learners. Blocked while any item has an issue.
 */
export async function sendAfterClass(
  teacherId: string,
  sessionId: string,
  now = new Date(),
): Promise<{ ok: true } | { ok: false; error: "not_held" | "issues" }> {
  const [session] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(
      and(
        eq(sessions.id, sessionId),
        eq(sessions.teacherId, teacherId),
        eq(sessions.status, "held"),
      ),
    );
  if (!session) return { ok: false, error: "not_held" };
  const items = await db
    .select({ id: assignments.id, type: assignments.type, body: assignments.body })
    .from(assignments)
    .where(and(eq(assignments.sessionId, sessionId), eq(assignments.teacherId, teacherId)));
  const fileMap = await assignmentFilesOf(items.map((i) => i.id));
  if (
    items.some((i) =>
      homeworkIssue(
        i.type,
        i.body,
        (fileMap.get(i.id) ?? []).map((f) => f.mime),
      ),
    )
  )
    return { ok: false, error: "issues" };
  await db.transaction(async (tx) => {
    await tx
      .update(assignments)
      .set({
        publishedAt: sql`coalesce(${assignments.publishedAt}, ${now.toISOString()}::timestamptz)`,
      })
      .where(eq(assignments.sessionId, sessionId));
    await tx.update(sessions).set({ afterClassSentAt: now }).where(eq(sessions.id, sessionId));
  });
  return { ok: true };
}
