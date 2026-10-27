import { and, asc, count, desc, eq, ilike, ne, notInArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  authSessions,
  leads,
  levelCheckSlots,
  studentStatusEnum,
  students,
  teacherLearners,
  users,
} from "@/db/schema";
import { toLatinDigits } from "@/lib/format";
import { phoneField } from "../forms";
import { loginState, type LoginState } from "./login";

export type LearnerStatus = (typeof studentStatusEnum.enumValues)[number];
export const learnerStatuses = studentStatusEnum.enumValues;

/** Empty optional fields are stored as null. Error keys map to `Admin.learners.errors`. */
const optional = (max: number, key: string) =>
  z
    .string()
    .trim()
    .max(max, key)
    .transform((v) => v || null);

/** Fields the teacher can edit at any time. Notes are the teacher's own; the rest is shared. */
export const learnerDetailsSchema = z.object({
  fullNameFa: z.string().trim().min(2, "fullNameFa").max(80, "fullNameFa"),
  fullNameEn: optional(80, "fullNameEn").refine((v) => v === null || v.length >= 2, "fullNameEn"),
  phone: phoneField,
  email: z
    .union([z.literal(""), z.email("email").max(120, "email")])
    .transform((v) => v.toLowerCase() || null),
  messengerHandle: optional(64, "messengerHandle"),
  notes: optional(2000, "notes"),
});

/** Adding a learner also sets the starting status and, optionally, the booking they came from. */
export const newLearnerSchema = learnerDetailsSchema.extend({
  status: z.enum(["lead", "active"], "status"),
  leadId: z.uuid().optional(),
});

export type LearnerDetails = z.output<typeof learnerDetailsSchema>;
export type NewLearner = z.output<typeof newLearnerSchema>;

export type SaveResult =
  | { ok: true; id: string }
  | { ok: false; error: "phone_taken"; existingId: string | null }
  | { ok: false; error: "lead_unavailable" }
  /** The number belongs to someone who also studies with another teacher: only names can change. */
  | { ok: false; error: "shared" };

class PhoneTaken extends Error {}
class LeadUnavailable extends Error {}

type Db = typeof db;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const link = (teacherId: string, studentId: string) =>
  and(eq(teacherLearners.teacherId, teacherId), eq(teacherLearners.studentId, studentId));

/** This teacher's learner with this number, if any. */
async function learnerIdByPhone(teacherId: string, phone: string) {
  const [row] = await db
    .select({ id: students.id })
    .from(students)
    .innerJoin(
      teacherLearners,
      and(eq(teacherLearners.studentId, students.id), eq(teacherLearners.teacherId, teacherId)),
    )
    .where(eq(students.phone, phone))
    .limit(1);
  return row?.id ?? null;
}

/**
 * Whether this teacher is the learner's only teacher. Only then may they change the learner's
 * number or send a login link: otherwise one teacher could take over an account another teacher's
 * learner uses.
 */
export async function isSoleTeacher(tx: Tx | Db, teacherId: string, studentId: string) {
  const [other] = await tx
    .select({ id: teacherLearners.teacherId })
    .from(teacherLearners)
    .where(and(eq(teacherLearners.studentId, studentId), ne(teacherLearners.teacherId, teacherId)))
    .limit(1);
  return !other;
}

/**
 * Saves a new learner for this teacher. One person has one record on the platform: if the number
 * already belongs to another teacher's learner, this teacher is linked to that person (their
 * shared details stay as they are). From a booking, the lead is marked converted in the same
 * transaction, so a booking turns into at most one learner.
 */
export async function createLearner(
  teacherId: string,
  input: NewLearner,
  now = new Date(),
): Promise<SaveResult> {
  const { leadId, status, notes, ...person } = input;
  try {
    const id = await db.transaction(async (tx) => {
      if (leadId) {
        const [lead] = await tx
          .update(leads)
          .set({ status: "converted" })
          .where(
            and(
              eq(leads.id, leadId),
              eq(leads.teacherId, teacherId),
              ne(leads.status, "converted"),
            ),
          )
          .returning({ id: leads.id });
        if (!lead) throw new LeadUnavailable();
      }
      const [existing] = await tx
        .select({ id: students.id })
        .from(students)
        .where(eq(students.phone, person.phone));
      const studentId =
        existing?.id ??
        (await tx.insert(students).values(person).returning({ id: students.id }))[0].id;
      const [linked] = await tx
        .insert(teacherLearners)
        .values({
          teacherId,
          studentId,
          status,
          notes,
          leadId: leadId ?? null,
          startedAt: status === "active" ? now : null,
        })
        .onConflictDoNothing()
        .returning({ id: teacherLearners.studentId });
      if (!linked) throw new PhoneTaken();
      return studentId;
    });
    return { ok: true, id };
  } catch (e) {
    if (e instanceof LeadUnavailable) return { ok: false, error: "lead_unavailable" };
    if (e instanceof PhoneTaken)
      return {
        ok: false,
        error: "phone_taken",
        existingId: await learnerIdByPhone(teacherId, input.phone),
      };
    throw e;
  }
}

/**
 * Updates the details of this teacher's learner. A learner with a login keeps it in step: same
 * number, same name. The number can change only while this is their only teacher.
 */
export async function updateLearner(
  teacherId: string,
  id: string,
  input: LearnerDetails,
): Promise<SaveResult | { ok: false; error: "not_found" }> {
  const { notes, ...person } = input;
  try {
    return await db.transaction(async (tx) => {
      const [current] = await tx
        .select({ userId: students.userId, phone: students.phone })
        .from(students)
        .innerJoin(teacherLearners, link(teacherId, id))
        .where(eq(students.id, id))
        .for("update");
      if (!current) return { ok: false as const, error: "not_found" as const };
      if (current.phone !== person.phone && !(await isSoleTeacher(tx, teacherId, id)))
        return { ok: false as const, error: "shared" as const };

      const [learnerClash] = await tx
        .select({ id: students.id })
        .from(students)
        .where(and(eq(students.phone, person.phone), ne(students.id, id)))
        .limit(1);
      if (learnerClash) throw new PhoneTaken();

      await tx.update(students).set(person).where(eq(students.id, id));
      await tx.update(teacherLearners).set({ notes }).where(link(teacherId, id));
      if (current.userId) {
        const [user] = await tx
          .update(users)
          .set({ phone: input.phone, displayName: input.fullNameFa })
          .where(
            and(
              eq(users.id, current.userId),
              // Another account (e.g. Mona's) already logs in with this number.
              sql`not exists (select 1 from ${users} u where u.phone = ${input.phone} and u.id <> ${current.userId})`,
            ),
          )
          .returning({ id: users.id });
        if (!user) throw new PhoneTaken();
      }
      return { ok: true as const, id };
    });
  } catch (e) {
    if (e instanceof PhoneTaken)
      return {
        ok: false,
        error: "phone_taken",
        existingId: await learnerIdByPhone(teacherId, input.phone),
      };
    throw e;
  }
}

/**
 * Changes this teacher's status for the learner. The first switch to active records the start
 * date. The login turns off (and every session ends) once the learner has left every teacher;
 * any other status turns it back on.
 */
export async function setLearnerStatus(
  teacherId: string,
  id: string,
  status: LearnerStatus,
  now = new Date(),
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(teacherLearners)
      .set({
        status,
        startedAt:
          status === "active"
            ? sql`coalesce(${teacherLearners.startedAt}, ${now.toISOString()}::timestamptz)`
            : undefined,
      })
      .where(link(teacherId, id))
      .returning({ studentId: teacherLearners.studentId });
    if (!row) return false;
    const [learner] = await tx
      .select({
        userId: students.userId,
        stays: sql<boolean>`exists (select 1 from ${teacherLearners} l where l.student_id = ${id} and l.status <> 'left')`,
      })
      .from(students)
      .where(eq(students.id, id));
    if (learner?.userId) {
      await tx.update(users).set({ isActive: learner.stays }).where(eq(users.id, learner.userId));
      if (!learner.stays)
        await tx.delete(authSessions).where(eq(authSessions.userId, learner.userId));
    }
    return true;
  });
}

/** "Not interested": the booking leaves the follow-up list. Converted bookings stay converted. */
export async function markLeadLost(teacherId: string, leadId: string): Promise<boolean> {
  const rows = await db
    .update(leads)
    .set({ status: "lost" })
    .where(and(eq(leads.id, leadId), eq(leads.teacherId, teacherId), ne(leads.status, "converted")))
    .returning({ id: leads.id });
  return rows.length > 0;
}

export type LearnerRow = {
  id: string;
  fullNameFa: string;
  fullNameEn: string | null;
  phone: string;
  status: LearnerStatus;
  startedAt: Date | null;
  login: LoginState;
};

const learnerColumns = {
  id: students.id,
  fullNameFa: students.fullNameFa,
  fullNameEn: students.fullNameEn,
  phone: students.phone,
  status: teacherLearners.status,
  startedAt: teacherLearners.startedAt,
  userId: users.id,
  isActive: users.isActive,
  passwordHash: users.passwordHash,
};

function toRow({
  userId,
  isActive,
  passwordHash,
  ...row
}: {
  id: string;
  fullNameFa: string;
  fullNameEn: string | null;
  phone: string;
  status: LearnerStatus;
  startedAt: Date | null;
  userId: string | null;
  isActive: boolean | null;
  passwordHash: string | null;
}): LearnerRow {
  return {
    ...row,
    login: loginState(userId ? { isActive: isActive ?? false, hasPassword: !!passwordHash } : null),
  };
}

/** Escapes LIKE wildcards in user input. */
const likeTerm = (v: string) => `%${v.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/**
 * The teacher's learners for the list, newest first. `q` matches either name, or the mobile number
 * however it is typed (0912…, Persian digits, spaces).
 */
export async function listLearners(
  teacherId: string,
  { status, q }: { status?: LearnerStatus; q?: string } = {},
): Promise<LearnerRow[]> {
  const term = q?.trim();
  const digits = term
    ? toLatinDigits(term)
        .replace(/\D/g, "")
        .replace(/^(0098|98|0)/, "")
    : "";
  const rows = await db
    .select(learnerColumns)
    .from(teacherLearners)
    .innerJoin(students, eq(students.id, teacherLearners.studentId))
    .leftJoin(users, eq(users.id, students.userId))
    .where(
      and(
        eq(teacherLearners.teacherId, teacherId),
        status ? eq(teacherLearners.status, status) : undefined,
        term
          ? or(
              ilike(students.fullNameFa, likeTerm(term)),
              ilike(students.fullNameEn, likeTerm(term)),
              digits.length >= 3 ? ilike(students.phone, likeTerm(digits)) : undefined,
            )
          : undefined,
      ),
    )
    .orderBy(desc(teacherLearners.createdAt));
  return rows.map(toRow);
}

/** How many of the teacher's learners have each status (every status present, zero included). */
export async function countByStatus(teacherId: string): Promise<Record<LearnerStatus, number>> {
  const rows = await db
    .select({ status: teacherLearners.status, n: count() })
    .from(teacherLearners)
    .where(eq(teacherLearners.teacherId, teacherId))
    .groupBy(teacherLearners.status);
  const out = Object.fromEntries(learnerStatuses.map((s) => [s, 0])) as Record<
    LearnerStatus,
    number
  >;
  for (const { status, n } of rows) out[status] = n;
  return out;
}

export type LearnerProfile = LearnerRow & {
  email: string | null;
  messengerHandle: string | null;
  notes: string | null;
  /** The free session they booked, when they came from one. */
  bookedSessionAt: Date | null;
  /** They also study with another teacher: their number and login are not this teacher's to change. */
  shared: boolean;
};

export async function getLearner(teacherId: string, id: string): Promise<LearnerProfile | null> {
  const [row] = await db
    .select({
      ...learnerColumns,
      email: students.email,
      messengerHandle: students.messengerHandle,
      notes: teacherLearners.notes,
      bookedSessionAt: levelCheckSlots.startsAt,
      shared: sql<boolean>`exists (select 1 from ${teacherLearners} o where o.student_id = ${id} and o.teacher_id <> ${teacherId})`,
    })
    .from(teacherLearners)
    .innerJoin(students, eq(students.id, teacherLearners.studentId))
    .leftJoin(users, eq(users.id, students.userId))
    .leftJoin(levelCheckSlots, eq(levelCheckSlots.leadId, teacherLearners.leadId))
    .where(link(teacherId, id));
  if (!row) return null;
  const { email, messengerHandle, notes, bookedSessionAt, shared, ...rest } = row;
  return { ...toRow(rest), email, messengerHandle, notes, bookedSessionAt, shared };
}

export type FollowUp = {
  id: string;
  name: string;
  phone: string;
  levelGuess: (typeof leads.$inferSelect)["levelGuess"];
  sessionAt: Date | null;
};

/** Bookings the teacher hasn't turned into a learner or closed, oldest session first. */
export async function listFollowUps(teacherId: string): Promise<FollowUp[]> {
  return db
    .select({
      id: leads.id,
      name: leads.name,
      phone: leads.phone,
      levelGuess: leads.levelGuess,
      sessionAt: levelCheckSlots.startsAt,
    })
    .from(leads)
    .leftJoin(levelCheckSlots, eq(levelCheckSlots.leadId, leads.id))
    .where(and(eq(leads.teacherId, teacherId), notInArray(leads.status, ["converted", "lost"])))
    .orderBy(asc(levelCheckSlots.startsAt), asc(leads.createdAt));
}

/** One of the teacher's bookings that can still become a learner, for prefilling the form. */
export async function getOpenLead(teacherId: string, id: string) {
  const [lead] = await db
    .select({ id: leads.id, name: leads.name, phone: leads.phone, notes: leads.notes })
    .from(leads)
    .where(and(eq(leads.id, id), eq(leads.teacherId, teacherId), ne(leads.status, "converted")));
  return lead ?? null;
}
