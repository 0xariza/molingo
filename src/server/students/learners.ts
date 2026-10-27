import { and, asc, count, desc, eq, ilike, ne, notInArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  authSessions,
  leads,
  levelCheckSlots,
  studentStatusEnum,
  students,
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

/** Fields Mona can edit at any time. */
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
  | { ok: false; error: "lead_unavailable" };

class PhoneTaken extends Error {}
class LeadUnavailable extends Error {}

async function learnerIdByPhone(phone: string) {
  const [row] = await db
    .select({ id: students.id })
    .from(students)
    .where(eq(students.phone, phone))
    .limit(1);
  return row?.id ?? null;
}

/**
 * Saves a new learner. From a booking, the lead is marked converted in the same transaction, so a
 * booking turns into at most one learner and a refused save leaves the lead as it was.
 */
export async function createLearner(input: NewLearner, now = new Date()): Promise<SaveResult> {
  const { leadId, ...learner } = input;
  try {
    const id = await db.transaction(async (tx) => {
      if (leadId) {
        const [lead] = await tx
          .update(leads)
          .set({ status: "converted" })
          .where(and(eq(leads.id, leadId), ne(leads.status, "converted")))
          .returning({ id: leads.id });
        if (!lead) throw new LeadUnavailable();
      }
      const [row] = await tx
        .insert(students)
        .values({
          ...learner,
          leadId: leadId ?? null,
          startedAt: learner.status === "active" ? now : null,
        })
        .onConflictDoNothing({ target: students.phone })
        .returning({ id: students.id });
      if (!row) throw new PhoneTaken();
      return row.id;
    });
    return { ok: true, id };
  } catch (e) {
    if (e instanceof LeadUnavailable) return { ok: false, error: "lead_unavailable" };
    if (e instanceof PhoneTaken)
      return { ok: false, error: "phone_taken", existingId: await learnerIdByPhone(input.phone) };
    throw e;
  }
}

/** Updates the details. A learner with a login keeps it in step: same number, same name. */
export async function updateLearner(
  id: string,
  input: LearnerDetails,
): Promise<SaveResult | { ok: false; error: "not_found" }> {
  try {
    return await db.transaction(async (tx) => {
      const [current] = await tx
        .select({ userId: students.userId })
        .from(students)
        .where(eq(students.id, id))
        .for("update");
      if (!current) return { ok: false as const, error: "not_found" as const };

      const [learnerClash] = await tx
        .select({ id: students.id })
        .from(students)
        .where(and(eq(students.phone, input.phone), ne(students.id, id)))
        .limit(1);
      if (learnerClash) throw new PhoneTaken();

      await tx.update(students).set(input).where(eq(students.id, id));
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
      return { ok: false, error: "phone_taken", existingId: await learnerIdByPhone(input.phone) };
    throw e;
  }
}

/**
 * Changes the status. The first switch to active records the start date. "Left" turns the login
 * off and signs the learner out everywhere; any other status turns it back on.
 */
export async function setLearnerStatus(
  id: string,
  status: LearnerStatus,
  now = new Date(),
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(students)
      .set({
        status,
        startedAt:
          status === "active"
            ? sql`coalesce(${students.startedAt}, ${now.toISOString()}::timestamptz)`
            : undefined,
      })
      .where(eq(students.id, id))
      .returning({ userId: students.userId });
    if (!row) return false;
    if (row.userId) {
      await tx
        .update(users)
        .set({ isActive: status !== "left" })
        .where(eq(users.id, row.userId));
      if (status === "left")
        await tx.delete(authSessions).where(eq(authSessions.userId, row.userId));
    }
    return true;
  });
}

/** "Not interested": the booking leaves the follow-up list. Converted bookings stay converted. */
export async function markLeadLost(leadId: string): Promise<boolean> {
  const rows = await db
    .update(leads)
    .set({ status: "lost" })
    .where(and(eq(leads.id, leadId), ne(leads.status, "converted")))
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
  status: students.status,
  startedAt: students.startedAt,
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
 * Learners for the list, newest first. `q` matches either name, or the mobile number however it
 * is typed (0912…, Persian digits, spaces).
 */
export async function listLearners({
  status,
  q,
}: { status?: LearnerStatus; q?: string } = {}): Promise<LearnerRow[]> {
  const term = q?.trim();
  const digits = term
    ? toLatinDigits(term)
        .replace(/\D/g, "")
        .replace(/^(0098|98|0)/, "")
    : "";
  const rows = await db
    .select(learnerColumns)
    .from(students)
    .leftJoin(users, eq(users.id, students.userId))
    .where(
      and(
        status ? eq(students.status, status) : undefined,
        term
          ? or(
              ilike(students.fullNameFa, likeTerm(term)),
              ilike(students.fullNameEn, likeTerm(term)),
              digits.length >= 3 ? ilike(students.phone, likeTerm(digits)) : undefined,
            )
          : undefined,
      ),
    )
    .orderBy(desc(students.createdAt));
  return rows.map(toRow);
}

/** How many learners have each status (every status present, zero included). */
export async function countByStatus(): Promise<Record<LearnerStatus, number>> {
  const rows = await db
    .select({ status: students.status, n: count() })
    .from(students)
    .groupBy(students.status);
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
};

export async function getLearner(id: string): Promise<LearnerProfile | null> {
  const [row] = await db
    .select({
      ...learnerColumns,
      email: students.email,
      messengerHandle: students.messengerHandle,
      notes: students.notes,
      bookedSessionAt: levelCheckSlots.startsAt,
    })
    .from(students)
    .leftJoin(users, eq(users.id, students.userId))
    .leftJoin(levelCheckSlots, eq(levelCheckSlots.leadId, students.leadId))
    .where(eq(students.id, id));
  if (!row) return null;
  const { email, messengerHandle, notes, bookedSessionAt, ...rest } = row;
  return { ...toRow(rest), email, messengerHandle, notes, bookedSessionAt };
}

export type FollowUp = {
  id: string;
  name: string;
  phone: string;
  levelGuess: (typeof leads.$inferSelect)["levelGuess"];
  sessionAt: Date | null;
};

/** Bookings Mona hasn't turned into a learner or closed as "not interested", oldest session first. */
export async function listFollowUps(): Promise<FollowUp[]> {
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
    .where(notInArray(leads.status, ["converted", "lost"]))
    .orderBy(asc(levelCheckSlots.startsAt), asc(leads.createdAt));
}

/** A booking that can still become a learner, for prefilling the form. */
export async function getOpenLead(id: string) {
  const [lead] = await db
    .select({ id: leads.id, name: leads.name, phone: leads.phone, notes: leads.notes })
    .from(leads)
    .where(and(eq(leads.id, id), ne(leads.status, "converted")));
  return lead ?? null;
}
