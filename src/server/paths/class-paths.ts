import { and, asc, eq, inArray, isNotNull, isNull, ne, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  classes,
  classPaths,
  classPathStations,
  learningSources,
  sessions,
  stationSkills,
  stations,
} from "@/db/schema";
import { planSessions, stationRanges } from "./plan";
import { isStationComplete, MAX_PLANNED_SESSIONS, MAX_SKILLS, MIN_SKILLS } from "./sources";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const planned = z.number().int().min(1, "planned").max(MAX_PLANNED_SESSIONS, "planned");

/** One row of a class path as the editor sends it, in path order. Error keys map to `Admin.paths.errors`. */
const pathItemSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("source"),
    stationId: z.uuid(),
    included: z.boolean(),
    plannedSessions: planned,
  }),
  z.object({
    kind: z.literal("custom"),
    /** Set for a class-only station that already exists. */
    stationId: z.uuid().optional(),
    title: z.string().trim().min(1, "customTitle").max(120, "customTitle"),
    plannedSessions: planned,
    skills: z
      .array(z.string().trim().max(160, "customSkills"))
      .transform((xs) => xs.filter(Boolean))
      .pipe(z.array(z.string()).min(MIN_SKILLS, "customSkills").max(MAX_SKILLS, "customSkills")),
  }),
]);

export const pathInputSchema = z.object({
  sourceId: z.uuid("source"),
  items: z.array(pathItemSchema).min(1, "items"),
});
export type PathInput = z.infer<typeof pathInputSchema>;

/** The editor's hidden `path` field (JSON) → a validated path, or the error key. */
export const pathField = z.string().transform((v, ctx) => {
  try {
    const parsed = pathInputSchema.safeParse(JSON.parse(v));
    if (parsed.success) return parsed.data;
    ctx.addIssue({ code: "custom", message: parsed.error.issues[0]?.message ?? "path" });
  } catch {
    ctx.addIssue({ code: "custom", message: "path" });
  }
  return z.NEVER;
});

export type PathError =
  "notFound" | "source" | "level" | "incomplete" | "stations" | "sourceLocked" | "locked";

/** Sessions that follow the path, in time order: regular ones and make-ups that replace one. */
async function pathSessions(tx: Tx | typeof db, classId: string) {
  return tx
    .select({ id: sessions.id, status: sessions.status, pathStationId: sessions.pathStationId })
    .from(sessions)
    .where(
      and(
        eq(sessions.classId, classId),
        ne(sessions.status, "cancelled"),
        or(eq(sessions.kind, "class"), isNotNull(sessions.replacesSessionId)),
      ),
    )
    .orderBy(asc(sessions.startsAt));
}

async function pathRows(tx: Tx | typeof db, pathId: string) {
  return tx
    .select({
      id: classPathStations.id,
      stationId: classPathStations.stationId,
      included: classPathStations.included,
      plannedSessions: classPathStations.plannedSessions,
    })
    .from(classPathStations)
    .where(eq(classPathStations.pathId, pathId))
    .orderBy(asc(classPathStations.position));
}

/**
 * Re-assigns the class's sessions that haven't been held to its path stations. Call after the
 * path or the sessions change; held sessions keep their station.
 */
export async function reassignSessions(tx: Tx | typeof db, classId: string) {
  const [path] = await tx
    .select({ id: classPaths.id })
    .from(classPaths)
    .where(eq(classPaths.classId, classId));
  if (!path) return;
  const [rows, list] = await Promise.all([pathRows(tx, path.id), pathSessions(tx, classId)]);
  const plan = planSessions(
    rows,
    list.map((s) => ({ id: s.id, held: s.status === "held", pathStationId: s.pathStationId })),
  );
  for (const s of list) {
    const next = plan.get(s.id) ?? null;
    if (next !== s.pathStationId)
      await tx.update(sessions).set({ pathStationId: next }).where(eq(sessions.id, s.id));
  }
}

/** Held sessions per path station (station id → count). */
async function heldByStation(tx: Tx | typeof db, classId: string, pathId: string) {
  const [rows, list] = await Promise.all([pathRows(tx, pathId), pathSessions(tx, classId)]);
  const out = new Map<string, number>();
  for (const s of list) {
    const row = rows.find((r) => r.id === s.pathStationId);
    if (s.status === "held" && row) out.set(row.stationId, (out.get(row.stationId) ?? 0) + 1);
  }
  return { rows, held: out };
}

/**
 * Creates or replaces the class's path. Source stations must all be listed (taken or not);
 * stations that already had held sessions stay taken, first and in order, with at least as many
 * sessions as were held. Then re-assigns the sessions.
 */
export async function setClassPath(
  tx: Tx,
  teacherId: string,
  classId: string,
  input: PathInput,
): Promise<PathError | null> {
  const [cls] = await tx
    .select({ level: classes.level })
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.teacherId, teacherId)));
  if (!cls) return "notFound";
  const [source] = await tx
    .select({ level: learningSources.level })
    .from(learningSources)
    .where(
      and(
        eq(learningSources.id, input.sourceId),
        eq(learningSources.teacherId, teacherId),
        isNull(learningSources.archivedAt),
      ),
    );
  if (!source) return "source";
  if (source.level !== cls.level) return "level";

  const sourceStations = await tx
    .select({ id: stations.id, title: stations.title })
    .from(stations)
    .where(eq(stations.sourceId, input.sourceId));
  const skillRows = await tx
    .select({ stationId: stationSkills.stationId })
    .from(stationSkills)
    .where(
      inArray(
        stationSkills.stationId,
        sourceStations.map((s) => s.id),
      ),
    );
  const complete = sourceStations.every((s) =>
    isStationComplete({
      title: s.title,
      skillCount: skillRows.filter((k) => k.stationId === s.id).length,
    }),
  );
  if (!sourceStations.length || !complete) return "incomplete";
  const listed = input.items.flatMap((i) => (i.kind === "source" ? [i.stationId] : []));
  if (
    new Set(listed).size !== listed.length ||
    listed.length !== sourceStations.length ||
    !listed.every((id) => sourceStations.some((s) => s.id === id))
  )
    return "stations";

  const [existing] = await tx
    .select({ id: classPaths.id, sourceId: classPaths.sourceId })
    .from(classPaths)
    .where(eq(classPaths.classId, classId));
  const ownCustom = await tx
    .select({ id: stations.id })
    .from(stations)
    .where(eq(stations.classId, classId));
  if (
    input.items.some(
      (i) => i.kind === "custom" && i.stationId && !ownCustom.some((s) => s.id === i.stationId),
    )
  )
    return "stations";

  let pathId: string;
  if (existing) {
    const { rows, held } = await heldByStation(tx, classId, existing.id);
    const locked = rows.filter((r) => held.has(r.stationId)).map((r) => r.stationId);
    if (locked.length && existing.sourceId !== input.sourceId) return "sourceLocked";
    const taken = input.items.filter((i) => i.kind === "custom" || i.included);
    const keepsLocked = locked.every((id, i) => {
      const item = taken[i];
      return item?.stationId === id && item.plannedSessions >= (held.get(id) ?? 0);
    });
    if (!keepsLocked) return "locked";
    pathId = existing.id;
    if (existing.sourceId !== input.sourceId)
      await tx
        .update(classPaths)
        .set({ sourceId: input.sourceId })
        .where(eq(classPaths.id, pathId));
  } else {
    const [row] = await tx
      .insert(classPaths)
      .values({ classId, sourceId: input.sourceId })
      .returning({ id: classPaths.id });
    pathId = row.id;
  }

  // Class-only stations: create new ones, update kept ones.
  const order: { stationId: string; included: boolean; plannedSessions: number }[] = [];
  for (const item of input.items) {
    if (item.kind === "source") {
      order.push(item);
      continue;
    }
    let stationId = item.stationId;
    if (stationId) {
      await tx
        .update(stations)
        .set({ title: item.title, plannedSessions: item.plannedSessions })
        .where(eq(stations.id, stationId));
      await tx.delete(stationSkills).where(eq(stationSkills.stationId, stationId));
    } else {
      const [row] = await tx
        .insert(stations)
        .values({ classId, position: 0, title: item.title, plannedSessions: item.plannedSessions })
        .returning({ id: stations.id });
      stationId = row.id;
    }
    await tx
      .insert(stationSkills)
      .values(item.skills.map((text, i) => ({ stationId: stationId!, position: i + 1, text })));
    order.push({ stationId, included: true, plannedSessions: item.plannedSessions });
  }

  const current = await pathRows(tx, pathId);
  const keep = new Set(order.map((o) => o.stationId));
  const dropped = current.filter((r) => !keep.has(r.stationId));
  if (dropped.length)
    await tx.delete(classPathStations).where(
      inArray(
        classPathStations.id,
        dropped.map((r) => r.id),
      ),
    );
  const droppedCustom = dropped.filter((r) => ownCustom.some((s) => s.id === r.stationId));
  if (droppedCustom.length)
    await tx.delete(stations).where(
      inArray(
        stations.id,
        droppedCustom.map((r) => r.stationId),
      ),
    );
  for (const [i, o] of order.entries()) {
    const row = current.find((r) => r.stationId === o.stationId);
    const values = { position: i + 1, included: o.included, plannedSessions: o.plannedSessions };
    if (row) await tx.update(classPathStations).set(values).where(eq(classPathStations.id, row.id));
    else await tx.insert(classPathStations).values({ pathId, stationId: o.stationId, ...values });
  }
  await reassignSessions(tx, classId);
  return null;
}

class PathRefused extends Error {
  constructor(readonly reason: PathError) {
    super(reason);
  }
}

/** Runs `setClassPath` inside a transaction, rolling it back when the path is refused. */
export async function inPathTransaction(
  run: (tx: Tx, refuse: (reason: PathError) => never) => Promise<void>,
): Promise<PathError | null> {
  try {
    await db.transaction((tx) =>
      run(tx, (reason) => {
        throw new PathRefused(reason);
      }),
    );
    return null;
  } catch (e) {
    if (e instanceof PathRefused) return e.reason;
    throw e;
  }
}

/** Saves the path of an existing class. */
export function saveClassPath(teacherId: string, classId: string, input: PathInput) {
  return inPathTransaction(async (tx, refuse) => {
    const error = await setClassPath(tx, teacherId, classId, input);
    if (error) refuse(error);
  });
}

/** The teacher's sources (optionally at one level) with their stations, for the path picker. */
export async function pathSources(
  teacherId: string,
  level?: (typeof classes.level.enumValues)[number],
) {
  const sources = await db
    .select({ id: learningSources.id, title: learningSources.title, level: learningSources.level })
    .from(learningSources)
    .where(
      and(
        eq(learningSources.teacherId, teacherId),
        level ? eq(learningSources.level, level) : undefined,
        isNull(learningSources.archivedAt),
      ),
    )
    .orderBy(asc(learningSources.title));
  if (!sources.length) return [];
  const rows = await db
    .select({
      id: stations.id,
      sourceId: stations.sourceId,
      title: stations.title,
      sourceUnit: stations.sourceUnit,
      plannedSessions: stations.plannedSessions,
    })
    .from(stations)
    .where(
      inArray(
        stations.sourceId,
        sources.map((s) => s.id),
      ),
    )
    .orderBy(asc(stations.position));
  const skills = rows.length
    ? await db
        .select({ stationId: stationSkills.stationId })
        .from(stationSkills)
        .where(
          inArray(
            stationSkills.stationId,
            rows.map((r) => r.id),
          ),
        )
    : [];
  return sources.map((s) => {
    const list = rows
      .filter((r) => r.sourceId === s.id)
      .map((r) => ({
        id: r.id,
        title: r.title,
        sourceUnit: r.sourceUnit,
        plannedSessions: r.plannedSessions,
        skillCount: skills.filter((k) => k.stationId === r.id).length,
      }));
    return { ...s, stations: list, complete: list.length > 0 && list.every(isStationComplete) };
  });
}

/**
 * The class's path for its page and editor: each station in path order with its sessions here
 * (numbers across the class), how many were held, and the class-only stations' skills.
 */
export async function getClassPath(teacherId: string, classId: string) {
  const [path] = await db
    .select({ id: classPaths.id, sourceId: classPaths.sourceId, title: learningSources.title })
    .from(classPaths)
    .innerJoin(classes, eq(classes.id, classPaths.classId))
    .innerJoin(learningSources, eq(learningSources.id, classPaths.sourceId))
    .where(and(eq(classPaths.classId, classId), eq(classes.teacherId, teacherId)));
  if (!path) return null;
  const [rows, list] = await Promise.all([pathRows(db, path.id), pathSessions(db, classId)]);
  const info = await db
    .select({
      id: stations.id,
      classId: stations.classId,
      title: stations.title,
      sourceUnit: stations.sourceUnit,
    })
    .from(stations)
    .where(
      inArray(
        stations.id,
        rows.map((r) => r.stationId),
      ),
    );
  const skills = await db
    .select({ stationId: stationSkills.stationId, text: stationSkills.text })
    .from(stationSkills)
    .where(
      inArray(
        stationSkills.stationId,
        rows.map((r) => r.stationId),
      ),
    )
    .orderBy(asc(stationSkills.position));
  const ranges = stationRanges(
    rows,
    list.map((s) => s.pathStationId),
  );
  return {
    sourceId: path.sourceId,
    sourceTitle: path.title,
    sessionCount: list.length,
    /** Per path session in order: the station it was held for, or null when not held yet. */
    heldStations: list.map((s) =>
      s.status === "held" ? (rows.find((r) => r.id === s.pathStationId)?.stationId ?? null) : null,
    ),
    stations: rows.map((r, i) => {
      const st = info.find((s) => s.id === r.stationId)!;
      return {
        pathStationId: r.id,
        stationId: r.stationId,
        custom: st.classId !== null,
        title: st.title,
        sourceUnit: st.sourceUnit,
        skills: skills.filter((k) => k.stationId === r.stationId).map((k) => k.text),
        included: r.included,
        plannedSessions: r.plannedSessions,
        held: list.filter((s) => s.pathStationId === r.id && s.status === "held").length,
        first: ranges[i].first,
        last: ranges[i].last,
      };
    }),
  };
}
