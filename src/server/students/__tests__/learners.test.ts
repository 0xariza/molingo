import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { authSessions, leads, students, users } from "@/db/schema";
import { createLevelCheckSlot, createUser, resetDb } from "@/test/factories";
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

beforeEach(() => resetDb(db));

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
  const slot = await createLevelCheckSlot(db, new Date(Date.now() + 86_400_000), { name, phone });
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
    const r = await createLearner(input(), now);
    expect(r.ok).toBe(true);
    const [row] = await db.select().from(students);
    expect(row).toMatchObject({ status: "active", phone: "+989121234567", userId: null });
    expect(row.startedAt).toEqual(now);
  });

  it("leaves the start date empty for a lead", async () => {
    await createLearner(input({ status: "lead" }));
    const [row] = await db.select().from(students);
    expect(row.startedAt).toBeNull();
  });

  it("refuses a second learner with the same number and points to the first", async () => {
    const first = await createLearner(input());
    const second = await createLearner(input({ fullNameFa: "نفر دوم", phone: "+989121234567" }));
    expect(second).toEqual({
      ok: false,
      error: "phone_taken",
      existingId: first.ok ? first.id : null,
    });
    expect(await db.select().from(students)).toHaveLength(1);
  });

  it("converts the booking it came from, once", async () => {
    const leadId = await bookedLead();
    const r = await createLearner(input({ leadId }));
    expect(r.ok).toBe(true);
    const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
    expect(lead.status).toBe("converted");
    const [row] = await db.select().from(students);
    expect(row.leadId).toBe(leadId);

    const again = await createLearner(input({ leadId, phone: "09129998888" }));
    expect(again).toEqual({ ok: false, error: "lead_unavailable" });
  });

  it("leaves the booking open when the learner can't be saved", async () => {
    await createLearner(input());
    const leadId = await bookedLead();
    const r = await createLearner(input({ leadId }));
    expect(r.ok).toBe(false);
    const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
    expect(lead.status).toBe("scheduled");
  });
});

describe("updateLearner", () => {
  it("keeps the login's number and name in step", async () => {
    const created = await createLearner(input());
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
    expect(await updateLearner(id, details)).toEqual({ ok: true, id });
    const [u] = await db.select().from(users).where(eq(users.id, user.id));
    expect(u).toMatchObject({ phone: "+989120001111", displayName: "سارا رضایی" });
  });

  it("refuses a number another learner or account already uses", async () => {
    const a = await createLearner(input());
    const b = await createLearner(input({ phone: "09120002222" }));
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

    expect(await updateLearner(bId, details("09121234567"))).toEqual({
      ok: false,
      error: "phone_taken",
      existingId: a.ok ? a.id : null,
    });
    await createUser(db, { phone: "+989120000001", role: "admin" });
    expect(await updateLearner(bId, details("09120000001"))).toMatchObject({
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
    expect(await updateLearner("0195f0a2-5d3e-7c1a-9b2e-3f4a5b6c7d8e", details)).toEqual({
      ok: false,
      error: "not_found",
    });
  });
});

describe("setLearnerStatus", () => {
  async function learnerWithLogin() {
    const r = await createLearner(input({ status: "lead" }));
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
    await setLearnerStatus(id, "active", first);
    await setLearnerStatus(id, "paused");
    await setLearnerStatus(id, "active", new Date("2026-10-01T08:00:00Z"));
    const [row] = await db.select().from(students).where(eq(students.id, id));
    expect(row.startedAt).toEqual(first);
  });

  it("turns the login off and signs out when they leave, and back on when they return", async () => {
    const { id, userId } = await learnerWithLogin();
    await setLearnerStatus(id, "left");
    let [u] = await db.select().from(users).where(eq(users.id, userId));
    expect(u.isActive).toBe(false);
    expect(await db.select().from(authSessions)).toHaveLength(0);

    await setLearnerStatus(id, "paused");
    [u] = await db.select().from(users).where(eq(users.id, userId));
    expect(u.isActive).toBe(true);
  });

  it("returns false for an unknown learner", async () => {
    expect(await setLearnerStatus("0195f0a2-5d3e-7c1a-9b2e-3f4a5b6c7d8e", "active")).toBe(false);
  });
});

describe("follow-ups", () => {
  it("lists open bookings only, and 'not interested' closes one", async () => {
    const open = await bookedLead("Open", "+989121110000");
    const lost = await bookedLead("Lost", "+989121110001");
    const converted = await bookedLead("Converted", "+989121110002");
    await createLearner(input({ leadId: converted }));
    expect(await markLeadLost(lost)).toBe(true);
    expect(await markLeadLost(converted)).toBe(false);

    const items = await listFollowUps();
    expect(items.map((i) => i.id)).toEqual([open]);
    expect(items[0].sessionAt).toBeInstanceOf(Date);
    expect(await getOpenLead(converted)).toBeNull();
    expect(await getOpenLead(open)).toMatchObject({ name: "Open" });
  });
});

describe("listing", () => {
  beforeEach(async () => {
    await createLearner(input());
    await createLearner(
      input({ fullNameFa: "آرش محمدی", fullNameEn: "Arash", phone: "09194507781", status: "lead" }),
    );
  });

  it("filters by status and counts every status", async () => {
    expect((await listLearners({ status: "lead" })).map((r) => r.fullNameEn)).toEqual(["Arash"]);
    expect(await countByStatus()).toEqual({ lead: 1, active: 1, paused: 0, left: 0 });
  });

  it("searches either name or the number as typed", async () => {
    expect((await listLearners({ q: "آرش" })).map((r) => r.fullNameEn)).toEqual(["Arash"]);
    expect((await listLearners({ q: "sara" })).map((r) => r.fullNameEn)).toEqual(["Sara Ahmadi"]);
    expect((await listLearners({ q: "۰۹۱۹ ۴۵۰" })).map((r) => r.fullNameEn)).toEqual(["Arash"]);
    expect(await listLearners({ q: "%" })).toEqual([]);
  });

  it("shows the profile with its login state and booking time", async () => {
    const leadId = await bookedLead();
    const r = await createLearner(input({ phone: "09125551234", leadId }));
    const profile = await getLearner(r.ok ? r.id : "");
    expect(profile).toMatchObject({ login: "none", fullNameFa: "سارا احمدی" });
    expect(profile!.bookedSessionAt).toBeInstanceOf(Date);
  });
});
