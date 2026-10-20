import { and, asc, count, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  cefrLevelEnum,
  classes,
  classSlots,
  enrollments,
  sessions,
  students,
  teachers,
} from "@/db/schema";
import { toLatinDigits } from "@/lib/format";
import {
  formatClock,
  nextDateOn,
  parseClock,
  sessionTimes,
  weekdayOf,
  WEEKDAYS,
  type Weekday,
} from "@/lib/schedule";
import { findClash, isOverlapError, type ClashWith } from "./clash";

export const cefrLevels = cefrLevelEnum.enumValues;
export type CefrLevel = (typeof cefrLevels)[number];
export const SESSION_LENGTHS = [30, 45, 60, 75, 90, 120] as const;
export const MAX_GROUP_CAPACITY = 4;

type Db = typeof db;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Mona's teacher record (created on first use; the MVP has one teacher). */
export async function teacherIdFor(userId: string): Promise<string> {
  const [row] = await db
    .insert(teachers)
    .values({ userId })
    .onConflictDoUpdate({ target: teachers.userId, set: { userId } })
    .returning({ id: teachers.id });
  return row.id;
}

const money = z
  .string()
  .transform((v) => Number(toLatinDigits(v).replace(/[^\d]/g, "")))
  .pipe(z.number().int("price").min(1, "price").max(1_000_000_000, "price"));

const jsonArray = <T extends z.ZodType>(item: T, key: string) =>
  z
    .string()
    .transform((v, ctx) => {
      try {
        return JSON.parse(v || "[]");
      } catch {
        ctx.addIssue({ code: "custom", message: key });
        return z.NEVER;
      }
    })
    .pipe(z.array(item, key));

const slotSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  time: z.string(),
});

/** Fields shared by "new class" and "edit class". Error keys map to `Admin.classes.errors`. */
const detailsShape = {
  nameFa: z.string().trim().min(2, "nameFa").max(80, "nameFa"),
  nameEn: z
    .string()
    .trim()
    .max(80, "nameEn")
    .transform((v) => v || null)
    .refine((v) => v === null || v.length >= 2, "nameEn"),
  level: z.enum(cefrLevels, "level"),
  price: money,
  description: z
    .string()
    .trim()
    .max(1000, "description")
    .transform((v) => v || null),
  isPublic: z.boolean(),
};

export const newClassSchema = z
  .object({
    ...detailsShape,
    type: z.enum(["private", "group"], "type"),
    capacity: z.coerce.number().int().min(1).max(MAX_GROUP_CAPACITY),
    sessionCount: z.coerce
      .number()
      .int("sessionCount")
      .min(1, "sessionCount")
      .max(60, "sessionCount"),
    sessionMinutes: z.coerce
      .number()
      .refine((n) => SESSION_LENGTHS.includes(n as 30), "sessionMinutes"),
    // Checked on the field so the error shows even when other fields fail too.
    slots: jsonArray(slotSchema, "slots").refine((a) => a.length > 0, "slots"),
    startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "startsOn"),
    studentIds: jsonArray(z.uuid(), "studentIds"),
    fromClassId: z.uuid().optional(),
  })
  .transform((v, ctx) => {
    const capacity = v.type === "private" ? 1 : v.capacity;
    if (v.type === "group" && capacity < 2)
      ctx.addIssue({ code: "custom", path: ["capacity"], message: "capacity" });
    const slots: { weekday: Weekday; minutes: number }[] = [];
    for (const s of v.slots) {
      const minutes = parseClock(s.time);
      if (minutes === null) ctx.addIssue({ code: "custom", path: ["slots"], message: "slotTime" });
      else slots.push({ weekday: s.weekday as Weekday, minutes });
    }
    if (new Set(slots.map((s) => s.weekday)).size !== slots.length)
      ctx.addIssue({ code: "custom", path: ["slots"], message: "slotDay" });
    if (slots.length && !slots.some((s) => s.weekday === weekdayOf(v.startsOn)))
      ctx.addIssue({ code: "custom", path: ["startsOn"], message: "startsOnDay" });
    if (v.studentIds.length > capacity)
      ctx.addIssue({ code: "custom", path: ["studentIds"], message: "tooMany" });
    return {
      ...v,
      capacity,
      isPublic: v.type === "group" && v.isPublic,
      slots: slots.sort((a, b) => a.weekday - b.weekday),
    };
  });

export type NewClass = z.output<typeof newClassSchema>;

export const editClassSchema = z.object({
  ...detailsShape,
  capacity: z.coerce.number().int().min(1).max(MAX_GROUP_CAPACITY),
});

export type EditClass = z.output<typeof editClassSchema>;

export type CreateResult =
  | { ok: true; id: string }
  | { ok: false; error: "past" | "clash"; clash?: ClashWith }
  | { ok: false; error: "learner_unavailable" };

class Refused extends Error {
  constructor(readonly result: Extract<CreateResult, { ok: false }>) {
    super(result.error);
  }
}

/**
 * Creates the class, its weekly slots, every session, and (optionally) its first learners, in one
 * transaction. Continuing from a finished class ends that class's places.
 */
export async function createClass(
  input: NewClass,
  teacherId: string,
  now = new Date(),
): Promise<CreateResult> {
  const times = sessionTimes({
    startsOn: input.startsOn,
    slots: input.slots,
    count: input.sessionCount,
    sessionMinutes: input.sessionMinutes,
  });
  if (times[0].startsAt <= now) return { ok: false, error: "past" };
  const clash = await findClash(teacherId, times);
  if (clash) return { ok: false, error: "clash", clash };

  try {
    const id = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(classes)
        .values({
          teacherId,
          nameFa: input.nameFa,
          nameEn: input.nameEn,
          level: input.level,
          type: input.type,
          capacity: input.capacity,
          sessionCount: input.sessionCount,
          sessionMinutes: input.sessionMinutes,
          startsOn: input.startsOn,
          priceToman: input.price,
          description: input.description,
          isPublic: input.isPublic,
        })
        .returning({ id: classes.id });
      await tx.insert(classSlots).values(
        input.slots.map((s) => ({
          classId: row.id,
          weekday: s.weekday,
          startTime: formatClock(s.minutes),
        })),
      );
      await tx.insert(sessions).values(times.map((t) => ({ ...t, teacherId, classId: row.id })));
      if (input.fromClassId) {
        await tx
          .update(enrollments)
          .set({ status: "ended", endedAt: now })
          .where(
            and(
              eq(enrollments.classId, input.fromClassId),
              eq(enrollments.status, "active"),
              // Only a finished class hands its learners on.
              sql`not exists (select 1 from ${sessions} s where s.class_id = ${input.fromClassId} and s.status = 'scheduled')`,
            ),
          );
      }
      for (const studentId of input.studentIds) {
        const placed = await placeLearner(tx, row.id, studentId, now);
        if (!placed.ok) throw new Refused({ ok: false, error: "learner_unavailable" });
      }
      return row.id;
    });
    return { ok: true, id };
  } catch (e) {
    if (e instanceof Refused) return e.result;
    if (isOverlapError(e)) return { ok: false, error: "clash" };
    throw e;
  }
}

export type PlaceResult =
  { ok: true } | { ok: false; error: "full" | "already" | "unavailable" | "finished" };

/**
 * Gives a learner a seat. The class row is locked, so two people can't take the last seat at once.
 * A lead becomes active. Learners who left can't be placed.
 */
export async function placeLearner(
  tx: Tx,
  classId: string,
  studentId: string,
  now = new Date(),
): Promise<PlaceResult> {
  const [cls] = await tx
    .select({ capacity: classes.capacity, archivedAt: classes.archivedAt })
    .from(classes)
    .where(eq(classes.id, classId))
    .for("update");
  if (!cls || cls.archivedAt) return { ok: false, error: "finished" };
  const [open] = await tx
    .select({ n: count() })
    .from(sessions)
    .where(and(eq(sessions.classId, classId), eq(sessions.status, "scheduled")));
  if (open.n === 0) return { ok: false, error: "finished" };

  const [learner] = await tx
    .select({ status: students.status })
    .from(students)
    .where(eq(students.id, studentId));
  if (!learner || learner.status === "left") return { ok: false, error: "unavailable" };

  const [taken] = await tx
    .select({ n: count() })
    .from(enrollments)
    .where(and(eq(enrollments.classId, classId), eq(enrollments.status, "active")));
  const [already] = await tx
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.classId, classId),
        eq(enrollments.studentId, studentId),
        eq(enrollments.status, "active"),
      ),
    );
  if (already) return { ok: false, error: "already" };
  if (taken.n >= cls.capacity) return { ok: false, error: "full" };

  await tx.insert(enrollments).values({ classId, studentId, startedAt: now });
  if (learner.status === "lead") {
    await tx
      .update(students)
      .set({
        status: "active",
        startedAt: sql`coalesce(${students.startedAt}, ${now.toISOString()}::timestamptz)`,
      })
      .where(eq(students.id, studentId));
  }
  return { ok: true };
}

export async function enroll(classId: string, studentId: string): Promise<PlaceResult> {
  return db.transaction((tx) => placeLearner(tx, classId, studentId));
}

export async function endEnrollment(classId: string, studentId: string, now = new Date()) {
  const rows = await db
    .update(enrollments)
    .set({ status: "ended", endedAt: now })
    .where(
      and(
        eq(enrollments.classId, classId),
        eq(enrollments.studentId, studentId),
        eq(enrollments.status, "active"),
      ),
    )
    .returning({ id: enrollments.id });
  return rows.length > 0;
}

class MoveRefused extends Error {
  constructor(readonly error: Exclude<PlaceResult, { ok: true }>["error"] | "not_enrolled") {
    super(error);
  }
}

/** Ends the place in one class and gives a seat in another, or neither. */
export async function moveLearner(
  fromClassId: string,
  toClassId: string,
  studentId: string,
  now = new Date(),
): Promise<{ ok: true } | { ok: false; error: MoveRefused["error"] }> {
  try {
    await db.transaction(async (tx) => {
      const ended = await tx
        .update(enrollments)
        .set({ status: "ended", endedAt: now })
        .where(
          and(
            eq(enrollments.classId, fromClassId),
            eq(enrollments.studentId, studentId),
            eq(enrollments.status, "active"),
          ),
        )
        .returning({ id: enrollments.id });
      if (!ended.length) throw new MoveRefused("not_enrolled");
      const placed = await placeLearner(tx, toClassId, studentId, now);
      if (!placed.ok) throw new MoveRefused(placed.error);
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof MoveRefused) return { ok: false, error: e.error };
    throw e;
  }
}

/** Edits what can change after creation. Capacity can't drop below the learners already in it. */
export async function updateClass(
  id: string,
  input: EditClass,
): Promise<{ ok: true } | { ok: false; error: "not_found" | "capacity" }> {
  return db.transaction(async (tx) => {
    const [cls] = await tx
      .select({ type: classes.type })
      .from(classes)
      .where(eq(classes.id, id))
      .for("update");
    if (!cls) return { ok: false, error: "not_found" };
    const capacity = cls.type === "private" ? 1 : input.capacity;
    const [taken] = await tx
      .select({ n: count() })
      .from(enrollments)
      .where(and(eq(enrollments.classId, id), eq(enrollments.status, "active")));
    if ((cls.type === "group" && capacity < 2) || capacity < taken.n)
      return { ok: false, error: "capacity" };
    await tx
      .update(classes)
      .set({
        nameFa: input.nameFa,
        nameEn: input.nameEn,
        level: input.level,
        capacity,
        priceToman: input.price,
        description: input.description,
        isPublic: cls.type === "group" && input.isPublic,
      })
      .where(eq(classes.id, id));
    return { ok: true };
  });
}

/** Archiving hides a class. Only possible once nobody is in it. */
export async function archiveClass(id: string, now = new Date()): Promise<boolean> {
  const rows = await db
    .update(classes)
    .set({ archivedAt: now })
    .where(
      and(
        eq(classes.id, id),
        isNull(classes.archivedAt),
        sql`not exists (select 1 from ${enrollments} e where e.class_id = ${classes.id} and e.status = 'active')`,
      ),
    )
    .returning({ id: classes.id });
  return rows.length > 0;
}

export type ClassState = "open" | "full" | "finished" | "archived";

export type ClassCard = {
  id: string;
  nameFa: string;
  nameEn: string | null;
  level: CefrLevel;
  type: "private" | "group";
  capacity: number;
  taken: number;
  isPublic: boolean;
  state: ClassState;
  slots: { weekday: Weekday; minutes: number }[];
  /** Active learners. */
  learnerIds: string[];
};

function stateOf(c: {
  archivedAt: Date | null;
  scheduled: number;
  taken: number;
  capacity: number;
}): ClassState {
  if (c.archivedAt) return "archived";
  if (c.scheduled === 0) return "finished";
  return c.taken >= c.capacity ? "full" : "open";
}

/** Every class with its seats and state, newest first. */
export async function listClasses(): Promise<ClassCard[]> {
  const rows = await db
    .select({
      id: classes.id,
      nameFa: classes.nameFa,
      nameEn: classes.nameEn,
      level: classes.level,
      type: classes.type,
      capacity: classes.capacity,
      isPublic: classes.isPublic,
      archivedAt: classes.archivedAt,
      // Qualified by hand: Drizzle leaves columns unqualified in single-table selects.
      scheduled: sql<number>`(select count(*)::int from ${sessions} s where s.class_id = "classes"."id" and s.status = 'scheduled')`,
    })
    .from(classes)
    .orderBy(sql`${classes.createdAt} desc`);
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [slotRows, people] = await Promise.all([
    db
      .select()
      .from(classSlots)
      .where(inArray(classSlots.classId, ids))
      .orderBy(asc(classSlots.weekday)),
    db
      .select({ classId: enrollments.classId, studentId: enrollments.studentId })
      .from(enrollments)
      .innerJoin(students, eq(students.id, enrollments.studentId))
      .where(and(inArray(enrollments.classId, ids), eq(enrollments.status, "active"))),
  ]);
  return rows.map(({ archivedAt, scheduled, ...r }) => {
    const mine = people.filter((p) => p.classId === r.id);
    return {
      ...r,
      taken: mine.length,
      state: stateOf({ archivedAt, scheduled, taken: mine.length, capacity: r.capacity }),
      slots: slotRows
        .filter((s) => s.classId === r.id)
        .map((s) => ({
          weekday: s.weekday as Weekday,
          minutes: parseClock(s.startTime.slice(0, 5))!,
        })),
      learnerIds: mine.map((p) => p.studentId),
    };
  });
}

/** Learners Mona can add to a class: everyone except those who left. */
export async function listCandidates() {
  return db
    .select({
      id: students.id,
      fullNameFa: students.fullNameFa,
      fullNameEn: students.fullNameEn,
      phone: students.phone,
      status: students.status,
    })
    .from(students)
    .where(ne(students.status, "left"))
    .orderBy(asc(students.fullNameFa));
}

export type ClassDefaults = Omit<NewClass, "price" | "fromClassId"> & {
  price: number;
  fromClassId: string;
};

/**
 * Prefill for "continue with next course": one level up, same learners and weekly times, starting
 * on the first class day after the last session. Only once every session is over.
 */
export async function nextCourseDefaults(id: string, today: string): Promise<ClassDefaults | null> {
  const [cls] = await db.select().from(classes).where(eq(classes.id, id));
  if (!cls || cls.archivedAt) return null;
  const [state] = await db
    .select({
      scheduled: sql<number>`count(*) filter (where ${sessions.status} = 'scheduled')::int`,
      last: sql<string | null>`max((${sessions.startsAt} at time zone 'Asia/Tehran')::date)::text`,
    })
    .from(sessions)
    .where(eq(sessions.classId, id));
  if (state.scheduled > 0 || !state.last) return null;
  const [slotRows, people] = await Promise.all([
    db.select().from(classSlots).where(eq(classSlots.classId, id)).orderBy(asc(classSlots.weekday)),
    db
      .select({ id: enrollments.studentId })
      .from(enrollments)
      .where(and(eq(enrollments.classId, id), eq(enrollments.status, "active"))),
  ]);
  const slots = slotRows.map((s) => ({
    weekday: s.weekday as Weekday,
    minutes: parseClock(s.startTime.slice(0, 5))!,
  }));
  const weekdays = slots.map((s) => s.weekday);
  const after = state.last > today ? state.last : today;
  const level = cefrLevels[Math.min(cefrLevels.indexOf(cls.level) + 1, cefrLevels.length - 1)];
  return {
    fromClassId: id,
    nameFa: cls.nameFa,
    nameEn: cls.nameEn,
    level,
    type: cls.type,
    capacity: cls.capacity,
    sessionCount: cls.sessionCount,
    sessionMinutes: cls.sessionMinutes,
    slots,
    startsOn: nextDateOn(after, weekdays.length ? weekdays : WEEKDAYS),
    price: cls.priceToman,
    description: cls.description,
    isPublic: cls.isPublic,
    studentIds: people.map((p) => p.id),
  };
}

/** Public group classes that still have seats and sessions ahead, for the landing page. */
export async function listFormingGroups() {
  const cards = await listClasses();
  const forming = cards.filter((c) => c.type === "group" && c.isPublic && c.state === "open");
  if (forming.length === 0) return [];
  const starts = await db
    .select({ id: classes.id, startsOn: classes.startsOn })
    .from(classes)
    .where(
      inArray(
        classes.id,
        forming.map((c) => c.id),
      ),
    );
  return forming.map((c) => ({
    id: c.id,
    nameFa: c.nameFa,
    nameEn: c.nameEn,
    level: c.level,
    slots: c.slots,
    free: c.capacity - c.taken,
    startsOn: starts.find((s) => s.id === c.id)!.startsOn,
  }));
}
