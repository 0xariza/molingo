import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { authTokens, students, users } from "@/db/schema";
import { hashToken } from "@/server/auth/crypto";
import { createUser, resetDb } from "@/test/factories";
import { createLearner, newLearnerSchema, setLearnerStatus } from "../learners";
import { createLogin, loginState, newLoginLink } from "../login";

beforeEach(async () => {
  vi.stubEnv("APP_URL", "https://molingo.test");
  await resetDb(db);
});

async function learner(phone = "09121234567") {
  const r = await createLearner(
    newLearnerSchema.parse({
      fullNameFa: "سارا احمدی",
      fullNameEn: "",
      phone,
      email: "",
      messengerHandle: "",
      notes: "",
      status: "active",
    }),
  );
  if (!r.ok) throw new Error("learner not created");
  return r.id;
}

const tokenOf = (url: string) => url.split("/").at(-1)!;

describe("loginState", () => {
  it("names each state", () => {
    expect(loginState(null)).toBe("none");
    expect(loginState({ isActive: true, hasPassword: false })).toBe("pending");
    expect(loginState({ isActive: true, hasPassword: true })).toBe("active");
    expect(loginState({ isActive: false, hasPassword: true })).toBe("off");
  });
});

describe("createLogin", () => {
  it("creates a student account and a working activation link", async () => {
    const admin = await createUser(db, { phone: "+989120000001", role: "admin" });
    const id = await learner();
    const r = await createLogin(id, admin.id);
    expect(r).toMatchObject({ ok: true, kind: "activation" });
    if (!r.ok) return;
    expect(r.url).toMatch(/^https:\/\/molingo\.test\/fa\/activate\/[\w-]{20,}$/);

    const [row] = await db.select().from(students).where(eq(students.id, id));
    const [user] = await db.select().from(users).where(eq(users.id, row.userId!));
    expect(user).toMatchObject({
      role: "student",
      phone: "+989121234567",
      displayName: "سارا احمدی",
      passwordHash: null,
    });
    const [token] = await db
      .select()
      .from(authTokens)
      .where(eq(authTokens.id, hashToken(tokenOf(r.url))));
    expect(token).toMatchObject({ kind: "activation", createdBy: admin.id, usedAt: null });
  });

  it("refuses a second login, or a number another account uses", async () => {
    const admin = await createUser(db, { phone: "+989120000001", role: "admin" });
    const id = await learner();
    await createLogin(id, admin.id);
    expect(await createLogin(id, admin.id)).toEqual({ ok: false, error: "has_login" });

    const monaNumber = await learner("09120000001");
    expect(await createLogin(monaNumber, admin.id)).toEqual({ ok: false, error: "phone_taken" });
    const [row] = await db.select().from(students).where(eq(students.id, monaNumber));
    expect(row.userId).toBeNull();
  });
});

describe("newLoginLink", () => {
  it("re-issues activation until a password is set, then a reset link", async () => {
    const admin = await createUser(db, { phone: "+989120000001", role: "admin" });
    const id = await learner();
    const first = await createLogin(id, admin.id);
    const second = await newLoginLink(id, admin.id);
    expect(second).toMatchObject({ ok: true, kind: "activation" });

    // Only the newest link works.
    const [old] = await db
      .select()
      .from(authTokens)
      .where(eq(authTokens.id, hashToken(tokenOf(first.ok ? first.url : ""))));
    expect(old.usedAt).not.toBeNull();

    const [row] = await db.select().from(students).where(eq(students.id, id));
    await db.update(users).set({ passwordHash: "set" }).where(eq(users.id, row.userId!));
    const reset = await newLoginLink(id, admin.id);
    expect(reset).toMatchObject({ ok: true, kind: "reset" });
    expect(reset.ok && reset.url).toContain("/fa/reset/");
  });

  it("refuses learners without a login, or whose login is off", async () => {
    const admin = await createUser(db, { phone: "+989120000001", role: "admin" });
    const id = await learner();
    expect(await newLoginLink(id, admin.id)).toEqual({ ok: false, error: "no_login" });
    await createLogin(id, admin.id);
    await setLearnerStatus(id, "left");
    expect(await newLoginLink(id, admin.id)).toEqual({ ok: false, error: "login_off" });
  });
});
