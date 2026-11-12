import { randomBytes } from "node:crypto";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db, type Db } from "@/db";
import {
  attendance,
  billedSessions,
  billingExemptions,
  classPrices,
  classes,
  enrollments,
  invoiceLines,
  invoices,
  payments,
  sessionParticipants,
  sessions,
  studentCredits,
} from "@/db/schema";
import { jalaliMonthKey, tehranDateKey } from "@/lib/format";
import { addDays } from "@/lib/schedule";
import { priceOn } from "./pricing";
import { getSettings } from "./settings";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const newCode = () => randomBytes(6).toString("base64url");

/** The signed sum of an invoice's lines. */
export async function invoiceTotal(exec: Pick<Db, "select">, invoiceId: string): Promise<number> {
  const [row] = await exec
    .select({ n: sql<string>`coalesce(sum(${invoiceLines.amountToman}), 0)` })
    .from(invoiceLines)
    .where(eq(invoiceLines.invoiceId, invoiceId));
  return Number(row.n);
}

export async function creditBalance(exec: Pick<Db, "select">, studentId: string): Promise<number> {
  const [row] = await exec
    .select({ n: sql<string>`coalesce(sum(${studentCredits.amountToman}), 0)` })
    .from(studentCredits)
    .where(eq(studentCredits.studentId, studentId));
  return Number(row.n);
}

/** Spends the learner's credit on the invoice, never more than it costs. */
async function applyCredit(tx: Tx, teacherId: string, studentId: string, invoiceId: string) {
  const take = Math.min(await creditBalance(tx, studentId), await invoiceTotal(tx, invoiceId));
  if (take <= 0) return;
  await tx
    .insert(invoiceLines)
    .values({ invoiceId, kind: "credit", description: "", amountToman: -take });
  await tx
    .insert(studentCredits)
    .values({ teacherId, studentId, amountToman: -take, reason: "applied", invoiceId });
}

export type Chargeable = { id: string; startsAt: Date };

/**
 * Held sessions this learner can still be billed for, up to the end of the Jalali month `period`:
 * theirs (enrolled then, or a make-up they were in), not excused, not exempted, not billed.
 * Cancelled sessions are never held, so they drop out on their own.
 */
export async function chargeableSessions(
  exec: Pick<Db, "select">,
  classId: string,
  studentId: string,
  period: string,
): Promise<Chargeable[]> {
  const rows = await exec
    .select({ id: sessions.id, startsAt: sessions.startsAt })
    .from(sessions)
    .where(
      and(
        eq(sessions.classId, classId),
        eq(sessions.status, "held"),
        sql`(
          (${sessions.kind} = 'class' and exists (select 1 from ${enrollments} e
            where e.class_id = ${sessions.classId} and e.student_id = ${studentId}
              and e.started_at <= ${sessions.startsAt}
              and (e.ended_at is null or e.ended_at >= ${sessions.startsAt})))
          or (${sessions.kind} = 'makeup' and exists (select 1 from ${sessionParticipants} p
            where p.session_id = ${sessions.id} and p.student_id = ${studentId}))
        )`,
        sql`not exists (select 1 from ${attendance} a where a.session_id = ${sessions.id}
          and a.student_id = ${studentId} and a.status = 'excused')`,
        sql`not exists (select 1 from ${billingExemptions} x where x.session_id = ${sessions.id}
          and x.student_id = ${studentId})`,
        sql`not exists (select 1 from ${billedSessions} b where b.session_id = ${sessions.id}
          and b.student_id = ${studentId})`,
      ),
    )
    .orderBy(asc(sessions.startsAt));
  return rows.filter((s) => jalaliMonthKey(s.startsAt) <= period);
}

async function priceChanges(exec: Pick<Db, "select">, classId: string) {
  return exec
    .select({ effectiveFrom: classPrices.effectiveFrom, priceToman: classPrices.priceToman })
    .from(classPrices)
    .where(eq(classPrices.classId, classId));
}

/**
 * The month's draft for a private class's learner: one line per chargeable session at the price
 * of that day, less any credit. Returns null when there is nothing to bill, or the month already
 * has an invoice (a voided one too: its sessions roll into the next month's draft).
 */
export async function draftMonthly(
  teacherId: string,
  classId: string,
  studentId: string,
  period: string,
  now = new Date(),
): Promise<string | null> {
  return db.transaction(async (tx) => {
    const [cls] = await tx
      .select({ price: classes.priceToman, type: classes.type })
      .from(classes)
      .where(and(eq(classes.id, classId), eq(classes.teacherId, teacherId)));
    if (!cls || cls.type !== "private") return null;
    const [taken] = await tx
      .select({ id: invoices.id })
      .from(invoices)
      .where(
        and(
          eq(invoices.studentId, studentId),
          eq(invoices.classId, classId),
          eq(invoices.period, period),
        ),
      );
    if (taken) return null;
    const charge = await chargeableSessions(tx, classId, studentId, period);
    if (!charge.length) return null;

    const [inv] = await tx
      .insert(invoices)
      .values({ teacherId, studentId, classId, kind: "monthly", period, shortCode: newCode() })
      .returning({ id: invoices.id });
    const changes = await priceChanges(tx, classId);
    await tx.insert(invoiceLines).values(
      charge.map((s) => ({
        invoiceId: inv.id,
        kind: "session" as const,
        description: tehranDateKey(s.startsAt),
        sessionId: s.id,
        amountToman: priceOn(cls.price, changes, tehranDateKey(s.startsAt)),
      })),
    );
    await tx
      .insert(billedSessions)
      .values(charge.map((s) => ({ sessionId: s.id, studentId, invoiceId: inv.id })));
    await applyCredit(tx, teacherId, studentId, inv.id);
    if ((await getSettings(tx, teacherId)).autoIssue) await issueIn(tx, teacherId, inv.id, now);
    return inv.id;
  });
}

/** The group's whole-course fee, issued the moment the learner joins. Null if they already have one. */
export async function createCourseInvoice(
  tx: Tx,
  teacherId: string,
  classId: string,
  studentId: string,
  fee: number,
  now: Date,
): Promise<string | null> {
  const [taken] = await tx
    .select({ id: invoices.id })
    .from(invoices)
    .where(
      and(
        eq(invoices.studentId, studentId),
        eq(invoices.classId, classId),
        eq(invoices.kind, "course"),
        ne(invoices.status, "void"),
      ),
    );
  if (taken) return null;
  const [inv] = await tx
    .insert(invoices)
    .values({ teacherId, studentId, classId, kind: "course", shortCode: newCode() })
    .returning({ id: invoices.id });
  await tx
    .insert(invoiceLines)
    .values({ invoiceId: inv.id, kind: "course_fee", description: "", amountToman: fee });
  await applyCredit(tx, teacherId, studentId, inv.id);
  await issueIn(tx, teacherId, inv.id, now);
  return inv.id;
}

async function issueIn(tx: Tx, teacherId: string, invoiceId: string, now: Date) {
  const { dueDays } = await getSettings(tx, teacherId);
  const rows = await tx
    .update(invoices)
    .set({
      status: "issued",
      issuedAt: now,
      dueOn: addDays(tehranDateKey(now), dueDays),
    })
    .where(
      and(
        eq(invoices.id, invoiceId),
        eq(invoices.teacherId, teacherId),
        eq(invoices.status, "draft"),
      ),
    )
    .returning({ id: invoices.id });
  return rows.length > 0;
}

/** Makes a draft visible to the learner and starts its due-date clock. */
export function issueInvoices(teacherId: string, ids: string[], now = new Date()) {
  return db.transaction(async (tx) => {
    const issued: string[] = [];
    for (const id of ids) if (await issueIn(tx, teacherId, id, now)) issued.push(id);
    return issued;
  });
}

export type VoidError = "not_found" | "has_payments";

/** Frees the sessions and gives back any credit it spent. An invoice with payments can't be voided. */
export async function voidInvoice(
  teacherId: string,
  invoiceId: string,
): Promise<{ ok: true } | { ok: false; error: VoidError }> {
  return db.transaction(async (tx) => {
    const [inv] = await tx
      .select({ studentId: invoices.studentId, status: invoices.status })
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.teacherId, teacherId)))
      .for("update");
    if (!inv || inv.status === "void") return { ok: false, error: "not_found" };
    const [paid] = await tx
      .select({ n: sql<string>`count(*)` })
      .from(payments)
      .where(eq(payments.invoiceId, invoiceId));
    if (Number(paid.n) > 0) return { ok: false, error: "has_payments" };
    const [spent] = await tx
      .select({ n: sql<string>`coalesce(sum(${studentCredits.amountToman}), 0)` })
      .from(studentCredits)
      .where(and(eq(studentCredits.invoiceId, invoiceId), eq(studentCredits.reason, "applied")));
    if (Number(spent.n) < 0) {
      await tx.insert(studentCredits).values({
        teacherId,
        studentId: inv.studentId,
        amountToman: -Number(spent.n),
        reason: "reversed",
        invoiceId,
      });
    }
    await tx.delete(billedSessions).where(eq(billedSessions.invoiceId, invoiceId));
    await tx.update(invoices).set({ status: "void" }).where(eq(invoices.id, invoiceId));
    return { ok: true };
  });
}

export const adjustmentSchema = z.object({
  invoiceId: z.string().uuid(),
  description: z.string().trim().min(1, "required").max(120),
  /** Negative = discount. */
  amount: z
    .number("amount")
    .int("amount")
    .refine((n) => n !== 0, "amount"),
});

export type EditError = "not_found" | "locked";

/** Draft and issued invoices can still change; the learner sees an issued one change. */
async function editable(tx: Tx, teacherId: string, invoiceId: string) {
  const [inv] = await tx
    .select({ status: invoices.status, studentId: invoices.studentId, classId: invoices.classId })
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.teacherId, teacherId)))
    .for("update");
  return inv;
}

export async function addAdjustment(
  teacherId: string,
  input: z.infer<typeof adjustmentSchema>,
): Promise<{ ok: true } | { ok: false; error: EditError }> {
  return db.transaction(async (tx) => {
    const inv = await editable(tx, teacherId, input.invoiceId);
    if (!inv) return { ok: false, error: "not_found" };
    if (inv.status === "void") return { ok: false, error: "locked" };
    await tx.insert(invoiceLines).values({
      invoiceId: input.invoiceId,
      kind: "adjustment",
      description: input.description,
      amountToman: input.amount,
    });
    return { ok: true };
  });
}

export async function removeAdjustment(
  teacherId: string,
  invoiceId: string,
  lineId: string,
): Promise<{ ok: true } | { ok: false; error: EditError }> {
  return db.transaction(async (tx) => {
    const inv = await editable(tx, teacherId, invoiceId);
    if (!inv) return { ok: false, error: "not_found" };
    if (inv.status === "void") return { ok: false, error: "locked" };
    await tx
      .delete(invoiceLines)
      .where(
        and(
          eq(invoiceLines.id, lineId),
          eq(invoiceLines.invoiceId, invoiceId),
          eq(invoiceLines.kind, "adjustment"),
        ),
      );
    return { ok: true };
  });
}

/**
 * "Don't charge this session" on a monthly invoice, or undo it. Charging it again only works while
 * the session is still billable (not billed elsewhere meanwhile).
 */
export async function setExempt(
  teacherId: string,
  invoiceId: string,
  sessionId: string,
  exempt: boolean,
): Promise<{ ok: true } | { ok: false; error: EditError }> {
  return db.transaction(async (tx) => {
    const inv = await editable(tx, teacherId, invoiceId);
    if (!inv) return { ok: false, error: "not_found" };
    if (inv.status === "void") return { ok: false, error: "locked" };
    const key = { sessionId, studentId: inv.studentId };
    if (exempt) {
      await tx.insert(billingExemptions).values(key).onConflictDoNothing();
      await tx
        .delete(invoiceLines)
        .where(and(eq(invoiceLines.invoiceId, invoiceId), eq(invoiceLines.sessionId, sessionId)));
      await tx
        .delete(billedSessions)
        .where(
          and(eq(billedSessions.sessionId, sessionId), eq(billedSessions.studentId, inv.studentId)),
        );
      return { ok: true };
    }
    await tx
      .delete(billingExemptions)
      .where(
        and(
          eq(billingExemptions.sessionId, sessionId),
          eq(billingExemptions.studentId, inv.studentId),
        ),
      );
    const [cls] = await tx
      .select({ price: classes.priceToman })
      .from(classes)
      .where(eq(classes.id, inv.classId));
    const [session] = await tx
      .select({ startsAt: sessions.startsAt })
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.classId, inv.classId)));
    if (!session) return { ok: false, error: "not_found" };
    const taken = await tx
      .insert(billedSessions)
      .values({ ...key, invoiceId })
      .onConflictDoNothing()
      .returning({ id: billedSessions.sessionId });
    if (!taken.length) return { ok: false, error: "locked" };
    const changes = await priceChanges(tx, inv.classId);
    await tx.insert(invoiceLines).values({
      invoiceId,
      kind: "session",
      description: tehranDateKey(session.startsAt),
      sessionId,
      amountToman: priceOn(cls.price, changes, tehranDateKey(session.startsAt)),
    });
    return { ok: true };
  });
}
