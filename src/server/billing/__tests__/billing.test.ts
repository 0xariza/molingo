import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { asc, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import {
  attendance,
  billedSessions,
  enrollments,
  files,
  invoices,
  payments,
  sessions,
  smsMessages,
  studentCredits,
  students,
  teacherLearners,
} from "@/db/schema";
import { fromTehranTime } from "@/lib/format";
import { createClass, moveLearner, newClassSchema } from "@/server/classes/classes";
import { cancelSession, markHeld } from "@/server/classes/sessions";
import { createTeacher, createUser, resetDb } from "@/test/factories";
import {
  addAdjustment,
  chargeableSessions,
  creditBalance,
  draftMonthly,
  issueInvoices,
  setExempt,
  voidInvoice,
} from "../invoices";
import { invoiceDetail } from "../detail";
import {
  addPrice,
  approveReceipt,
  moveCreditProposal,
  recordPayment,
  rejectReceipt,
  submitReceipt,
} from "../payments";
import { listInvoiceRows } from "../reports";
import { runBillingSweep } from "../sweep";

beforeAll(async () => {
  process.env.UPLOAD_DIR = await mkdtemp(join(tmpdir(), "hoopo-uploads-"));
});

const created = fromTehranTime("2026-10-14", "12:00");
const later = fromTehranTime("2026-12-01", "10:00");
let teacherId: string;

beforeEach(async () => {
  await resetDb(db);
  const user = await createUser(db, { phone: "+989120000001", role: "teacher" });
  teacherId = (await createTeacher(db, user.id)).id;
});

async function learner(phone: string, name: string) {
  const user = await createUser(db, { phone });
  const [s] = await db
    .insert(students)
    .values({ userId: user.id, fullNameFa: name, phone })
    .returning({ id: students.id });
  await db.insert(teacherLearners).values({ teacherId, studentId: s.id, status: "active" });
  return s.id;
}

async function makeClass(
  type: "private" | "group",
  studentIds: string[],
  price = "650000",
  time = "08:00",
) {
  const made = await createClass(
    newClassSchema.parse({
      nameFa: type === "private" ? "خصوصی" : "گروه",
      nameEn: "",
      level: "A2",
      type,
      capacity: type === "private" ? "1" : "4",
      sessionCount: type === "private" ? "10" : "12",
      sessionMinutes: "60",
      // Saturday + Sunday: 24 Oct..21 Nov are Aban 1405 (the 9th session is Aban 30), the 10th is 1 Azar.
      slots: JSON.stringify([
        { weekday: 0, time },
        { weekday: 1, time },
      ]),
      startsOn: "2026-10-24",
      price,
      description: "",
      isPublic: false,
      studentIds: JSON.stringify(studentIds),
    }),
    teacherId,
    created,
  );
  if (!made.ok) throw new Error(made.error);
  const list = await db
    .select()
    .from(sessions)
    .where(eq(sessions.classId, made.id))
    .orderBy(asc(sessions.startsAt));
  return { classId: made.id, list };
}

const hold = (sessionId: string, studentId: string, status: "present" | "absent" | "excused") =>
  markHeld(teacherId, sessionId, { [studentId]: status }, later);

/** Ten sessions: 1 present, 2 present, 3 absent, 4 excused, 5 present, 6 present, 7 present, 8 cancelled, 9 present, 10 present (1 Azar). */
async function monthOfSessions() {
  const sara = await learner("+989130000001", "سارا");
  const { classId, list } = await makeClass("private", [sara]);
  const marks = [
    "present",
    "present",
    "absent",
    "excused",
    "present",
    "present",
    "present",
    null,
    "present",
    "present",
  ] as const;
  for (const [i, m] of marks.entries()) {
    if (m) await hold(list[i].id, sara, m);
    else expect(await cancelSession(teacherId, list[i].id, null, created)).toBe(true);
  }
  return { sara, classId, list };
}

describe("monthly invoices for a private class", () => {
  it("charges held sessions at the price of their day; absences count, excused and cancelled do not", async () => {
    const { sara, classId } = await monthOfSessions();
    // 650,000 until 7 Nov, then 700,000: 8 Nov is the first session at the new price.
    expect(
      await addPrice(teacherId, { classId, price: 700_000, effectiveFrom: "2026-11-08" }),
    ).toEqual({ ok: true });

    const id = await draftMonthly(teacherId, classId, sara, "1405-08", later);
    expect(id).not.toBeNull();
    const [row] = await listInvoiceRows(teacherId, later);
    // 24, 25, 31 Oct (the last an absence) and 7 Nov at 650k; 8, 14 and 21 Nov at 700k.
    expect(row).toMatchObject({ status: "draft", total: 4 * 650_000 + 3 * 700_000, paid: 0 });
    // The 22 Nov session (1 Azar) belongs to next month.
    const detail = await invoiceDetail(id!, { teacherId }, later);
    expect(detail!.lines).toHaveLength(7);
    expect(detail!.skipped.map((s) => s.why).sort()).toEqual(["cancelled", "excused"]);
  });

  it("is idempotent: a month is drafted once and a session is billed once", async () => {
    const { sara, classId } = await monthOfSessions();
    expect(await draftMonthly(teacherId, classId, sara, "1405-08", later)).not.toBeNull();
    expect(await draftMonthly(teacherId, classId, sara, "1405-08", later)).toBeNull();
    expect(await db.select().from(billedSessions)).toHaveLength(7);
    expect(await chargeableSessions(db, classId, sara, "1405-08")).toHaveLength(0);
  });

  it("does not charge sessions before the learner joined", async () => {
    const sara = await learner("+989130000001", "سارا");
    const { classId, list } = await makeClass("private", []);
    for (const i of [0, 1])
      expect(await markHeld(teacherId, list[i].id, {}, later)).toEqual({ ok: true });
    await db.insert(enrollments).values({ classId, studentId: sara, startedAt: list[2].startsAt });
    for (const i of [2, 3]) await hold(list[i].id, sara, "present");
    const rows = await chargeableSessions(db, classId, sara, "1405-08");
    expect(rows.map((r) => r.id)).toEqual([list[2].id, list[3].id]);
  });

  it("'Don't charge' removes a session; charging it again puts it back", async () => {
    const { sara, classId, list } = await monthOfSessions();
    const id = (await draftMonthly(teacherId, classId, sara, "1405-08", later))!;
    expect(await setExempt(teacherId, id, list[1].id, true)).toEqual({ ok: true });
    expect((await listInvoiceRows(teacherId, later))[0].total).toBe(6 * 650_000);
    expect(await setExempt(teacherId, id, list[1].id, false)).toEqual({ ok: true });
    expect((await listInvoiceRows(teacherId, later))[0].total).toBe(7 * 650_000);
  });

  it("a voided invoice frees its sessions into the next month's draft", async () => {
    const { sara, classId } = await monthOfSessions();
    const first = (await draftMonthly(teacherId, classId, sara, "1405-08", later))!;
    expect(await voidInvoice(teacherId, first)).toEqual({ ok: true });
    expect(await draftMonthly(teacherId, classId, sara, "1405-08", later)).toBeNull();
    const next = (await draftMonthly(teacherId, classId, sara, "1405-09", later))!;
    const detail = await invoiceDetail(next, { teacherId }, later);
    expect(detail!.lines).toHaveLength(8);
  });

  it("adjustments change the total, discounts included", async () => {
    const { sara, classId } = await monthOfSessions();
    const id = (await draftMonthly(teacherId, classId, sara, "1405-08", later))!;
    await addAdjustment(teacherId, { invoiceId: id, description: "book", amount: 200_000 });
    await addAdjustment(teacherId, { invoiceId: id, description: "discount", amount: -50_000 });
    expect((await listInvoiceRows(teacherId, later))[0].total).toBe(7 * 650_000 + 150_000);
  });

  it("other teachers can't see or change it", async () => {
    const { sara, classId } = await monthOfSessions();
    const id = (await draftMonthly(teacherId, classId, sara, "1405-08", later))!;
    const other = await createUser(db, { phone: "+989120000009", role: "teacher" });
    const otherId = (await createTeacher(db, other.id)).id;
    expect(await invoiceDetail(id, { teacherId: otherId }, later)).toBeNull();
    expect(await issueInvoices(otherId, [id])).toEqual([]);
    expect(await voidInvoice(otherId, id)).toEqual({ ok: false, error: "not_found" });
  });
});

describe("payments and credit", () => {
  async function issued() {
    const { sara, classId } = await monthOfSessions();
    const id = (await draftMonthly(teacherId, classId, sara, "1405-08", later))!;
    await issueInvoices(teacherId, [id], later);
    return { sara, id, total: 7 * 650_000 };
  }
  const pay = (studentId: string, invoiceId: string | undefined, amount: number) =>
    recordPayment(teacherId, {
      studentId,
      invoiceId,
      amount,
      paidOn: "2026-12-02",
      method: "cash",
    });

  it("a partial payment leaves the rest; paying more than owed becomes credit", async () => {
    const { sara, id, total } = await issued();
    await pay(sara, id, 1_000_000);
    expect((await listInvoiceRows(teacherId, later))[0]).toMatchObject({
      state: "partial",
      left: total - 1_000_000,
    });
    await pay(sara, id, total - 1_000_000 + 300_000);
    expect((await listInvoiceRows(teacherId, later))[0]).toMatchObject({ state: "paid", left: 0 });
    expect(await creditBalance(db, sara)).toBe(300_000);
  });

  it("credit comes off the next invoice, and voiding gives it back", async () => {
    const { sara, id } = await issued();
    await pay(sara, undefined, 300_000);
    expect(await creditBalance(db, sara)).toBe(300_000);
    const [{ classId }] = await db.select({ classId: invoices.classId }).from(invoices);
    await voidInvoice(teacherId, id);
    const next = (await draftMonthly(teacherId, classId, sara, "1405-09", later))!;
    expect((await invoiceDetail(next, { teacherId }, later))!.row.total).toBe(
      8 * 650_000 - 300_000,
    );
    expect(await creditBalance(db, sara)).toBe(0);
    await voidInvoice(teacherId, next);
    expect(await creditBalance(db, sara)).toBe(300_000);
  });

  it("an invoice with payments can't be voided", async () => {
    const { sara, id } = await issued();
    await pay(sara, id, 100_000);
    expect(await voidInvoice(teacherId, id)).toEqual({ ok: false, error: "has_payments" });
  });

  it("a draft can't be paid", async () => {
    const { sara, classId } = await monthOfSessions();
    const id = (await draftMonthly(teacherId, classId, sara, "1405-08", later))!;
    expect(await pay(sara, id, 1000)).toEqual({ ok: false, error: "draft" });
  });

  it("isolates payments to the learner's own invoice", async () => {
    const { id } = await issued();
    const other = await learner("+989130000003", "کیان");
    expect(await pay(other, id, 1000)).toEqual({ ok: false, error: "not_found" });
  });
});

describe("receipts", () => {
  async function pending() {
    const { sara, classId } = await monthOfSessions();
    const id = (await draftMonthly(teacherId, classId, sara, "1405-08", later))!;
    await issueInvoices(teacherId, [id], later);
    const [student] = await db.select().from(students).where(eq(students.id, sara));
    const [file] = await db
      .insert(files)
      .values({
        ownerUserId: student.userId!,
        originalName: "r.jpg",
        mime: "image/jpeg",
        sizeBytes: 10,
      })
      .returning({ id: files.id });
    const sent = await submitReceipt(sara, file.id, {
      invoiceId: id,
      amount: 2_000_000,
      cardLast4: "5821",
    });
    if (!sent.ok) throw new Error(sent.error);
    return { sara, id, receiptId: sent.id };
  }

  it("approving records a payment at the amount the teacher saw, once", async () => {
    const { id, receiptId } = await pending();
    const ok = await approveReceipt(teacherId, receiptId, 1_900_000, "2026-12-02");
    expect(ok).toMatchObject({ ok: true, amount: 1_900_000 });
    expect(await approveReceipt(teacherId, receiptId, 1_900_000, "2026-12-02")).toEqual({
      ok: false,
      error: "decided",
    });
    const rows = await db.select().from(payments).where(eq(payments.invoiceId, id));
    expect(rows.map((p) => p.amountToman)).toEqual([1_900_000]);
  });

  it("only one receipt waits per invoice, and a rejected one lets the learner try again", async () => {
    const { sara, id, receiptId } = await pending();
    const [file] = await db.select().from(files);
    expect(await submitReceipt(sara, file.id, { invoiceId: id, amount: 1, cardLast4: "" })).toEqual(
      {
        ok: false,
        error: "already_pending",
      },
    );
    expect(await rejectReceipt(teacherId, receiptId, "unreadable")).toMatchObject({ ok: true });
    expect(
      await submitReceipt(sara, file.id, { invoiceId: id, amount: 1, cardLast4: "" }),
    ).toMatchObject({ ok: true });
    expect(await db.select().from(payments)).toHaveLength(0);
  });
});

describe("group courses and moves", () => {
  it("joining a group issues the whole-course fee once", async () => {
    const a = await learner("+989130000001", "علی");
    const { classId } = await makeClass("group", [a], "6500000");
    const rows = await listInvoiceRows(teacherId, later);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "course", status: "issued", total: 6_500_000, classId });
    expect(rows[0].dueOn).toBe("2026-10-21");
  });

  it("moving credits the unused share and takes it off the new class's fee", async () => {
    const ali = await learner("+989130000001", "علی");
    const from = await makeClass("group", [ali], "6500000");
    const to = await makeClass("group", [], "6500000", "14:00");
    await recordPayment(teacherId, {
      studentId: ali,
      invoiceId: (await db.select().from(invoices).where(eq(invoices.classId, from.classId)))[0].id,
      amount: 6_500_000,
      paidOn: "2026-10-20",
      method: "card",
    });
    await hold(from.list[0].id, ali, "present");
    await hold(from.list[1].id, ali, "present");
    const proposal = (await moveCreditProposal(teacherId, from.classId, ali))!;
    // 10 of 12 sessions to come: 6,500,000 × 10 / 12 = 5,416,666 → 5,416,000.
    expect(proposal).toMatchObject({ paid: 6_500_000, remaining: 10, suggested: 5_416_000 });
    expect(
      await moveLearner(teacherId, from.classId, to.classId, ali, created, proposal.suggested),
    ).toEqual({ ok: true });
    const [mine] = await db.select().from(invoices).where(eq(invoices.classId, to.classId));
    expect((await invoiceDetail(mine.id, { teacherId }, later))!.row).toMatchObject({
      total: 6_500_000 - 5_416_000,
      left: 6_500_000 - 5_416_000,
    });
    expect(await creditBalance(db, ali)).toBe(0);
    expect(await db.select().from(studentCredits)).toHaveLength(2);
  });
});

describe("the sweep", () => {
  it("drafts last month's invoices once, even if run twice", async () => {
    await monthOfSessions();
    await runBillingSweep(teacherId, later);
    await runBillingSweep(teacherId, later);
    const rows = await listInvoiceRows(teacherId, later);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "draft", period: "1405-08" });
    expect(await db.select().from(attendance)).toHaveLength(9);
  });

  it("sends each reminder once", async () => {
    const { sara, classId } = await monthOfSessions();
    const id = (await draftMonthly(teacherId, classId, sara, "1405-08", later))!;
    await issueInvoices(teacherId, [id], later); // due 8 Dec
    const overdue = fromTehranTime("2026-12-20", "10:00");
    await runBillingSweep(teacherId, overdue);
    await runBillingSweep(teacherId, overdue);
    const sms = await db.select().from(smsMessages);
    expect(sms.map((m) => m.kind)).toEqual(["overdue"]);
    expect(sms[0].status).toBe("logged");
  });
});
