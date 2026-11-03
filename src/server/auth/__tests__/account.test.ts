import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { authSessions, users } from "@/db/schema";
import { createUser, resetDb } from "@/test/factories";
import { changePassword, recordLogin, setPreferredLocale } from "../account";
import { hashToken } from "../crypto";
import { createSession } from "../sessions";
import { verifyPassword } from "../password";

beforeEach(() => resetDb(db));

describe("account", () => {
  it("recordLogin stores the login time and the language used", async () => {
    const user = await createUser(db, { locale: "fa" });
    await recordLogin(user.id, "en");
    const [saved] = await db.select().from(users).where(eq(users.id, user.id));
    expect(saved.locale).toBe("en");
    expect(saved.lastLoginAt).toBeInstanceOf(Date);
  });

  it("setPreferredLocale changes only the language", async () => {
    const user = await createUser(db, { locale: "en" });
    await setPreferredLocale(user.id, "fa");
    const [saved] = await db.select().from(users).where(eq(users.id, user.id));
    expect(saved.locale).toBe("fa");
    expect(saved.lastLoginAt).toBeNull();
  });
});

describe("changePassword", () => {
  const input = { current: "blue-whale-42", next: "green-turtle-77", confirm: "green-turtle-77" };

  it("needs the current password, a good new one and a matching repeat", async () => {
    const user = await createUser(db, { password: "blue-whale-42" });
    const { token } = await createSession(user.id);
    expect(await changePassword(user, { ...input, current: "nope-nope-1" }, token)).toBe("wrong");
    expect(await changePassword(user, { ...input, next: "short", confirm: "short" }, token)).toBe(
      "too_short",
    );
    expect(await changePassword(user, { ...input, confirm: "green-turtle-78" }, token)).toBe(
      "mismatch",
    );
    const [unchanged] = await db.select().from(users).where(eq(users.id, user.id));
    expect(await verifyPassword(unchanged.passwordHash!, "blue-whale-42")).toBe(true);
  });

  it("sets the password and signs out every other device", async () => {
    const user = await createUser(db, { password: "blue-whale-42" });
    const here = await createSession(user.id);
    await createSession(user.id);
    expect(await changePassword(user, input, here.token)).toBe("ok");

    const [saved] = await db.select().from(users).where(eq(users.id, user.id));
    expect(await verifyPassword(saved.passwordHash!, "green-turtle-77")).toBe(true);
    const left = await db.select().from(authSessions).where(eq(authSessions.userId, user.id));
    expect(left.map((s) => s.id)).toEqual([hashToken(here.token)]);
  });
});
