import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { authSessions, leads, students, teacherLearners, users } from "@/db/schema";
import { createLevelCheckSlot, createTeacher, createUser, resetDb } from "@/test/factories";
import { createLogin, newLoginLink } from "../login";
import {
  countByStatus,
  createLearner,
  getLearner,
  getOpenLead,
  learnerDetailsSchema,
  listFollowUps,
  listLearners,
  markLeadLost,
  newLearnerSchema,
  setLearnerStatus,
  updateLearner,
} from "../learners";

/** Mona's teacher id. */
let tid: string;
beforeEach(async () => {
  await resetDb(db);
  const mona = await createUser(db, { phone: "+989120000001", role: "teacher" });
  tid = (await createTeacher(db, mona.id)).id;
});

/** Mona's record of a learner. */
const linkOf = async (studentId?: string) => {
  const rows = await db.select().from(teacherLearners);
  return rows.find((l) => !studentId || l.studentId === studentId)!;
};

const input = (overrides: Record<string, string> = {}) =>
  newLearnerSchema.parse({
    fullNameFa: "سارا احمدی",
    fullNameEn: "Sara Ahmadi",
    phone: "۰۹۱۲ ۱۲۳ ۴۵۶۷",
    email: "",
    messengerHandle: "",
    notes: "",
    status: "active",
    ...overrides,
  });

async function bookedLead(name = "Nika Rahimi", phone = "+989125551234") {
  const slot = await createLevelCheckSlot(db, tid, new Date(Date.now() + 86_400_000), {
    name,
    phone,
  });
  return slot.leadId!;
}

describe("learner input", () => {
  it("normalizes the phone and stores empty optional fields as null", () => {
    const r = input({ fullNameEn: " ", email: "SARA@Example.com" });
    expect(r.phone).toBe("+989121234567");
    expect(r.fullNameEn).toBeNull();
    expect(r.email).toBe("sara@example.com");
    expect(r.notes).toBeNull();
  });

  it("reports each invalid field with its key", () => {
    const r = newLearnerSchema.safeParse({
      fullNameFa: "س",
      fullNameEn: "S",
      phone: "12",
      email: "nope",
      messengerHandle: "",
      notes: "",
      status: "left",
    });
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => [i.path[0], i.message])).toEqual(
      expect.arrayContaining([
        ["fullNameFa", "fullNameFa"],
        ["fullNameEn", "fullNameEn"],
        ["phone", "phone"],
        ["email", "email"],
        ["status", "status"],
      ]),
    );
  });

  it("edits never change the status", () => {
    expect(learnerDetailsSchema.shape).not.toHaveProperty("status");
  });
});

describe("createLearner", () => {
  it("saves an active learner with today's start date", async () => {
    const now = new Date("2026-10-14T10:00:00Z");
    const r = await createLearner(tid, input(), now);
    expect(r.ok).toBe(true);
    const [row] = await db.select().from(students);
    expect(row).toMatchObject({ phone: "+989121234567", userId: null });
    expect(await linkOf(row.id)).toMatchObject({
      teacherId: tid,
      status: "active",
      startedAt: now,
    });
  });

  it("leaves the start date empty for a lead", async () => {
    await createLearner(tid, input({ status: "lead" }));
    expect((await linkOf()).startedAt).toBeNull();
  });

  it("refuses a second learner with the same number and points to the first", async () => {
    const first = await createLearner(tid, input());
    const second = await createLearner(
      tid,
      input({ fullNameFa: "نفر دوم", phone: "+989121234567" }),
    );
    expect(second).toEqual({
      ok: false,
      error: "phone_taken",
      existingId: first.ok ? first.id : null,
    });
    expect(await db.select().from(students)).toHaveLength(1);
  });

  it("converts the booking it came from, once", async () => {
    const leadId = await bookedLead();
    const r = await createLearner(tid, input({ leadId }));
    expect(r.ok).toBe(true);
    const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
    expect(lead.status).toBe("converted");
    expect((await linkOf()).leadId).toBe(leadId);

    const again = await createLearner(tid, input({ leadId, phone: "09129998888" }));
    expect(again).toEqual({ ok: false, error: "lead_unavailable" });
  });

  it("leaves the booking open when the learner can't be saved", async () => {
    await createLearner(tid, input());
    const leadId = await bookedLead();
    const r = await createLearner(tid, input({ leadId }));
    expect(r.ok).toBe(false);
    const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
    expect(lead.status).toBe("scheduled");
  });
});

describe("updateLearner", () => {
  it("keeps the login's number and name in step", async () => {
    const created = await createLearner(tid, input());
    const id = created.ok ? created.id : "";
    const user = await createUser(db, { phone: "+989121234567" });
    await db.update(students).set({ userId: user.id }).where(eq(students.id, id));

    const details = learnerDetailsSchema.parse({
      ...input(),
      fullNameFa: "سارا رضایی",
      phone: "09120001111",
      email: "",
      messengerHandle: "",
      notes: "",
      fullNameEn: "",
    });
    expect(await updateLearner(tid, id, details)).toEqual({ ok: true, id });
    const [u] = await db.select().from(users).where(eq(users.id, user.id));
    expect(u).toMatchObject({ phone: "+989120001111", displayName: "سارا رضایی" });
  });

  it("refuses a number another learner or account already uses", async () => {
    const a = await createLearner(tid, input());
    const b = await createLearner(tid, input({ phone: "09120002222" }));
    const bId = b.ok ? b.id : "";
    const user = await createUser(db, { phone: "+989120002222" });
    await db.update(students).set({ userId: user.id }).where(eq(students.id, bId));
    const details = (phone: string) =>
      learnerDetailsSchema.parse({
        ...input(),
        phone,
        fullNameEn: "",
        email: "",
        messengerHandle: "",
        notes: "",
      });

    expect(await updateLearner(tid, bId, details("09121234567"))).toEqual({
      ok: false,
      error: "phone_taken",
      existingId: a.ok ? a.id : null,
    });
    await createUser(db, { phone: "+989120000005", role: "owner" });
    expect(await updateLearner(tid, bId, details("09120000005"))).toMatchObject({
      ok: false,
      error: "phone_taken",
    });
    const [row] = await db.select().from(students).where(eq(students.id, bId));
    expect(row.phone).toBe("+989120002222");
  });

  it("reports a learner that doesn't exist", async () => {
    const details = learnerDetailsSchema.parse({
      ...input(),
      fullNameEn: "",
      email: "",
      messengerHandle: "",
      notes: "",
    });
    expect(await updateLearner(tid, "0195f0a2-5d3e-7c1a-9b2e-3f4a5b6c7d8e", details)).toEqual({
      ok: false,
      error: "not_found",
    });
  });
});

describe("setLearnerStatus", () => {
  async function learnerWithLogin() {
    const r = await createLearner(tid, input({ status: "lead" }));
    const id = r.ok ? r.id : "";
    const user = await createUser(db, { phone: "+989121234567", password: "pass-2026-x" });
    await db.update(students).set({ userId: user.id }).where(eq(students.id, id));
    await db.insert(authSessions).values({
      id: "session-hash",
      userId: user.id,
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    return { id, userId: user.id };
  }

  it("records the first start date only", async () => {
    const { id } = await learnerWithLogin();
    const first = new Date("2026-09-01T08:00:00Z");
    await setLearnerStatus(tid, id, "active", first);
    await setLearnerStatus(tid, id, "paused");
    await setLearnerStatus(tid, id, "active", new Date("2026-10-01T08:00:00Z"));
    expect((await linkOf(id)).startedAt).toEqual(first);
  });

  it("turns the login off and signs out when they leave, and back on when they return", async () => {
    const { id, userId } = await learnerWithLogin();
    await setLearnerStatus(tid, id, "left");
    let [u] = await db.select().from(users).where(eq(users.id, userId));
    expect(u.isActive).toBe(false);
    expect(await db.select().from(authSessions)).toHaveLength(0);

    await setLearnerStatus(tid, id, "paused");
    [u] = await db.select().from(users).where(eq(users.id, userId));
    expect(u.isActive).toBe(true);
  });

  it("returns false for an unknown learner", async () => {
    expect(await setLearnerStatus(tid, "0195f0a2-5d3e-7c1a-9b2e-3f4a5b6c7d8e", "active")).toBe(
      false,
    );
  });
});

describe("follow-ups", () => {
  it("lists open bookings only, and 'not interested' closes one", async () => {
    const open = await bookedLead("Open", "+989121110000");
    const lost = await bookedLead("Lost", "+989121110001");
    const converted = await bookedLead("Converted", "+989121110002");
    await createLearner(tid, input({ leadId: converted }));
    expect(await markLeadLost(tid, lost)).toBe(true);
    expect(await markLeadLost(tid, converted)).toBe(false);

    const items = await listFollowUps(tid);
    expect(items.map((i) => i.id)).toEqual([open]);
    expect(items[0].sessionAt).toBeInstanceOf(Date);
    expect(await getOpenLead(tid, converted)).toBeNull();
    expect(await getOpenLead(tid, open)).toMatchObject({ name: "Open" });
  });
});

describe("listing", () => {
  beforeEach(async () => {
    await createLearner(tid, input());
    await createLearner(
      tid,
      input({ fullNameFa: "آرش محمدی", fullNameEn: "Arash", phone: "09194507781", status: "lead" }),
    );
  });

  it("filters by status and counts every status", async () => {
    expect((await listLearners(tid, { status: "lead" })).map((r) => r.fullNameEn)).toEqual([
      "Arash",
    ]);
    expect(await countByStatus(tid)).toEqual({ lead: 1, active: 1, paused: 0, left: 0 });
  });

  it("searches either name or the number as typed", async () => {
    expect((await listLearners(tid, { q: "آرش" })).map((r) => r.fullNameEn)).toEqual(["Arash"]);
    expect((await listLearners(tid, { q: "sara" })).map((r) => r.fullNameEn)).toEqual([
      "Sara Ahmadi",
    ]);
    expect((await listLearners(tid, { q: "۰۹۱۹ ۴۵۰" })).map((r) => r.fullNameEn)).toEqual([
      "Arash",
    ]);
    expect(await listLearners(tid, { q: "%" })).toEqual([]);
  });

  it("shows the profile with its login state and booking time", async () => {
    const leadId = await bookedLead();
    const r = await createLearner(tid, input({ phone: "09125551234", leadId }));
    const profile = await getLearner(tid, r.ok ? r.id : "");
    expect(profile).toMatchObject({ login: "none", fullNameFa: "سارا احمدی" });
    expect(profile!.bookedSessionAt).toBeInstanceOf(Date);
  });
});

describe("two teachers", () => {
  async function ali() {
    const user = await createUser(db, { phone: "+989120000009", role: "teacher" });
    return (await createTeacher(db, user.id)).id;
  }
  const details = (overrides: Record<string, string> = {}) =>
    learnerDetailsSchema.parse({
      ...input(),
      fullNameEn: "",
      email: "",
      messengerHandle: "",
      notes: "",
      ...overrides,
    });

  it("share one person by mobile number, each with their own status and notes", async () => {
    const mona = await createLearner(tid, input({ notes: "Mona's note" }));
    const other = await ali();
    const theirs = await createLearner(other, input({ status: "lead", notes: "Ali's note" }));
    expect(theirs).toEqual(mona);
    expect(await db.select().from(students)).toHaveLength(1);
    const id = mona.ok ? mona.id : "";
    expect(await getLearner(tid, id)).toMatchObject({ status: "active", notes: "Mona's note" });
    expect(await getLearner(other, id)).toMatchObject({ status: "lead", notes: "Ali's note" });
    expect(await countByStatus(other)).toEqual({ lead: 1, active: 0, paused: 0, left: 0 });
  });

  it("never see or change each other's learners or bookings", async () => {
    const r = await createLearner(tid, input());
    const id = r.ok ? r.id : "";
    const lead = await bookedLead();
    const other = await ali();
    expect(await listLearners(other)).toEqual([]);
    expect(await getLearner(other, id)).toBeNull();
    expect(await updateLearner(other, id, details({ fullNameFa: "دیگری" }))).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(await setLearnerStatus(other, id, "left")).toBe(false);
    expect(await listFollowUps(other)).toEqual([]);
    expect(await getOpenLead(other, lead)).toBeNull();
    expect(await markLeadLost(other, lead)).toBe(false);
    expect(await createLearner(other, input({ phone: "09125551234", leadId: lead }))).toEqual({
      ok: false,
      error: "lead_unavailable",
    });
    expect(await createLogin(other, id, "x")).toEqual({ ok: false, error: "not_found" });
  });

  it("only a learner's sole teacher changes their number or sends login links", async () => {
    const r = await createLearner(tid, input());
    const id = r.ok ? r.id : "";
    const mona = (await db.select().from(users).where(eq(users.role, "teacher")))[0];
    const other = await ali();
    await createLearner(other, input());
    expect(await updateLearner(tid, id, details({ phone: "09120007777" }))).toEqual({
      ok: false,
      error: "shared",
    });
    expect(await updateLearner(other, id, details({ fullNameFa: "سارا رضایی" }))).toEqual({
      ok: true,
      id,
    });
    expect(await createLogin(tid, id, mona.id)).toEqual({ ok: false, error: "shared" });
    expect(await newLoginLink(other, id, mona.id)).toEqual({ ok: false, error: "shared" });
  });

  it("keeps the login on until the learner has left every teacher", async () => {
    const r = await createLearner(tid, input());
    const id = r.ok ? r.id : "";
    const user = await createUser(db, { phone: "+989121234567" });
    await db.update(students).set({ userId: user.id }).where(eq(students.id, id));
    const other = await ali();
    await createLearner(other, input());
    await setLearnerStatus(tid, id, "left");
    expect((await db.select().from(users).where(eq(users.id, user.id)))[0].isActive).toBe(true);
    await setLearnerStatus(other, id, "left");
    expect((await db.select().from(users).where(eq(users.id, user.id)))[0].isActive).toBe(false);
  });
});
