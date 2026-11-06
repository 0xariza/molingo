import { and, asc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  cefrLevelEnum,
  classPathStations,
  learningSources,
  stationSkills,
  stations,
} from "@/db/schema";
import { toLatinDigits } from "@/lib/format";

export const MIN_SKILLS = 3;
export const MAX_SKILLS = 4;
export const MAX_PLANNED_SESSIONS = 4;
export const MAX_CHAPTERS = 30;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const count = (min: number, max: number, key: string) =>
  z
    .string()
    .transform((v) => Number(toLatinDigits(v).trim()))
    .pipe(z.number().int(key).min(min, key).max(max, key));

/** "New source": its name, level and how many chapters become stations. Error keys map to `Admin.sources.errors`. */
export const newSourceSchema = z.object({
  title: z.string().trim().min(1, "title").max(120, "title"),
  level: z.enum(cefrLevelEnum.enumValues, "level"),
  chapters: count(1, MAX_CHAPTERS, "chapters"),
  plannedSessions: count(1, MAX_PLANNED_SESSIONS, "plannedSessions"),
});
export type NewSource = z.infer<typeof newSourceSchema>;

/** One station as the teacher saves it. Empty skill lines are dropped; at most four are kept. */
export const stationSchema = z.object({
  title: z.string().trim().max(120, "title"),
  sourceUnit: z.string().trim().max(60, "sourceUnit"),
  plannedSessions: count(1, MAX_PLANNED_SESSIONS, "plannedSessions"),
  skills: z
    .array(z.string().trim().max(160, "skills"))
    .transform((xs) => xs.filter(Boolean))
    .pipe(z.array(z.string()).max(MAX_SKILLS, "skills")),
});
export type StationInput = z.infer<typeof stationSchema>;

/** A station is ready for classes once it has a title and 3–4 skills. */
export const isStationComplete = (s: { title: string; skillCount: number }) =>
  s.title.trim() !== "" && s.skillCount >= MIN_SKILLS;

/** The map's state, as listed on the sources page. */
export function mapState(list: { title: string; skillCount: number }[]) {
  const done = list.filter(isStationComplete).length;
  return {
    total: list.length,
    done,
    state:
      list.length === 0
        ? ("empty" as const)
        : done === list.length
          ? ("complete" as const)
          : ("partial" as const),
  };
}

export async function createSource(input: NewSource, teacherId: string) {
  return db.transaction(async (tx) => {
    const [source] = await tx
      .insert(learningSources)
      .values({ teacherId, title: input.title, level: input.level })
      .returning({ id: learningSources.id });
    await tx.insert(stations).values(
      Array.from({ length: input.chapters }, (_, i) => ({
        sourceId: source.id,
        position: i + 1,
        plannedSessions: input.plannedSessions,
      })),
    );
    return source.id;
  });
}

async function skillCounts(stationIds: string[]) {
  if (!stationIds.length) return new Map<string, number>();
  const rows = await db
    .select({ stationId: stationSkills.stationId, n: sql<number>`count(*)::int` })
    .from(stationSkills)
    .where(inArray(stationSkills.stationId, stationIds))
    .groupBy(stationSkills.stationId);
  return new Map(rows.map((r) => [r.stationId, r.n]));
}

/** The teacher's sources (newest first) with their map state. */
export async function listSources(teacherId: string) {
  const sources = await db
    .select({ id: learningSources.id, title: learningSources.title, level: learningSources.level })
    .from(learningSources)
    .where(and(eq(learningSources.teacherId, teacherId), isNull(learningSources.archivedAt)))
    .orderBy(sql`${learningSources.createdAt} desc`);
  if (!sources.length) return [];
  const rows = await db
    .select({ id: stations.id, sourceId: stations.sourceId, title: stations.title })
    .from(stations)
    .where(
      inArray(
        stations.sourceId,
        sources.map((s) => s.id),
      ),
    );
  const counts = await skillCounts(rows.map((r) => r.id));
  return sources.map((s) => ({
    ...s,
    ...mapState(
      rows
        .filter((r) => r.sourceId === s.id)
        .map((r) => ({ title: r.title, skillCount: counts.get(r.id) ?? 0 })),
    ),
  }));
}

/** One source with its stations in order and each station's skills, or null when not this teacher's. */
export async function getSource(teacherId: string, sourceId: string) {
  const [source] = await db
    .select({ id: learningSources.id, title: learningSources.title, level: learningSources.level })
    .from(learningSources)
    .where(
      and(
        eq(learningSources.id, sourceId),
        eq(learningSources.teacherId, teacherId),
        isNull(learningSources.archivedAt),
      ),
    );
  if (!source) return null;
  const list = await db
    .select({
      id: stations.id,
      position: stations.position,
      title: stations.title,
      sourceUnit: stations.sourceUnit,
      plannedSessions: stations.plannedSessions,
    })
    .from(stations)
    .where(eq(stations.sourceId, sourceId))
    .orderBy(asc(stations.position));
  const skills = list.length
    ? await db
        .select({ stationId: stationSkills.stationId, text: stationSkills.text })
        .from(stationSkills)
        .where(
          inArray(
            stationSkills.stationId,
            list.map((s) => s.id),
          ),
        )
        .orderBy(asc(stationSkills.position))
    : [];
  return {
    ...source,
    stations: list.map((s) => ({
      ...s,
      skills: skills.filter((k) => k.stationId === s.id).map((k) => k.text),
    })),
  };
}

/** The station's source row when it belongs to this teacher. */
async function ownedStation(tx: Tx | typeof db, teacherId: string, stationId: string) {
  const [row] = await tx
    .select({ id: stations.id, sourceId: stations.sourceId, position: stations.position })
    .from(stations)
    .innerJoin(learningSources, eq(learningSources.id, stations.sourceId))
    .where(and(eq(stations.id, stationId), eq(learningSources.teacherId, teacherId)));
  return row ? { ...row, sourceId: row.sourceId! } : null;
}

export async function saveStation(teacherId: string, stationId: string, input: StationInput) {
  return db.transaction(async (tx) => {
    if (!(await ownedStation(tx, teacherId, stationId))) return false;
    await tx
      .update(stations)
      .set({
        title: input.title,
        sourceUnit: input.sourceUnit,
        plannedSessions: input.plannedSessions,
      })
      .where(eq(stations.id, stationId));
    await tx.delete(stationSkills).where(eq(stationSkills.stationId, stationId));
    if (input.skills.length)
      await tx
        .insert(stationSkills)
        .values(input.skills.map((text, i) => ({ stationId, position: i + 1, text })));
    return true;
  });
}

/** Adds an empty station right after this one and returns its id. */
export async function addStationAfter(teacherId: string, stationId: string) {
  return db.transaction(async (tx) => {
    const at = await ownedStation(tx, teacherId, stationId);
    if (!at) return null;
    await tx
      .update(stations)
      .set({ position: sql`${stations.position} + 1` })
      .where(and(eq(stations.sourceId, at.sourceId), gt(stations.position, at.position)));
    const [row] = await tx
      .insert(stations)
      .values({ sourceId: at.sourceId, position: at.position + 1, plannedSessions: 2 })
      .returning({ id: stations.id });
    return row.id;
  });
}

/** Swaps a station with its neighbour (-1 earlier, +1 later). False at either end. */
export async function moveStation(teacherId: string, stationId: string, dir: -1 | 1) {
  return db.transaction(async (tx) => {
    const at = await ownedStation(tx, teacherId, stationId);
    if (!at) return false;
    const [other] = await tx
      .select({ id: stations.id })
      .from(stations)
      .where(and(eq(stations.sourceId, at.sourceId), eq(stations.position, at.position + dir)));
    if (!other) return false;
    await tx.update(stations).set({ position: at.position }).where(eq(stations.id, other.id));
    await tx
      .update(stations)
      .set({ position: at.position + dir })
      .where(eq(stations.id, at.id));
    return true;
  });
}

/** Removes a station and closes the gap. A source always keeps at least one station. */
export async function deleteStation(teacherId: string, stationId: string) {
  return db.transaction(async (tx) => {
    const at = await ownedStation(tx, teacherId, stationId);
    if (!at) return "notFound" as const;
    const [{ n }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(stations)
      .where(eq(stations.sourceId, at.sourceId));
    if (n <= 1) return "lastStation" as const;
    const [used] = await tx
      .select({ id: classPathStations.id })
      .from(classPathStations)
      .where(eq(classPathStations.stationId, stationId))
      .limit(1);
    if (used) return "inUse" as const;
    await tx.delete(stations).where(eq(stations.id, stationId));
    await tx
      .update(stations)
      .set({ position: sql`${stations.position} - 1` })
      .where(and(eq(stations.sourceId, at.sourceId), gt(stations.position, at.position)));
    return "ok" as const;
  });
}
