import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createUser, resetDb } from "@/test/factories";
import { verifyPassword } from "../password";
import { createSession, validateSessionToken } from "../sessions";
import { findValidAuthToken, issueAuthToken, redeemAuthToken } from "../tokens";

beforeEach(() => resetDb(db));

describe("activation and reset links", () => {
  it("sets the password once; the link can't be reused", async () => {
    const user = await createUser(db);
    const { token } = await issueAuthToken(user.id, "activation");
    expect((await findValidAuthToken(token, "activation"))?.userId).toBe(user.id);
    expect(await redeemAuthToken(token, "activation", "blue-whale-42")).toEqual({
      id: user.id,
      role: "student",
    });
    expect(await redeemAuthToken(token, "activation", "other-pass-99")).toBeNull();
    expect(await findValidAuthToken(token, "activation")).toBeNull();

    const [saved] = await db.select().from(users).where(eq(users.id, user.id));
    expect(await verifyPassword(saved.passwordHash!, "blue-whale-42")).toBe(true);
  });

  it("only the newest link works", async () => {
    const user = await createUser(db);
    const first = await issueAuthToken(user.id, "reset");
    const second = await issueAuthToken(user.id, "reset");
    expect(await findValidAuthToken(first.token, "reset")).toBeNull();
    expect(await findValidAuthToken(second.token, "reset")).not.toBeNull();
  });

  it("rejects the wrong kind of link", async () => {
    const user = await createUser(db);
    const { token } = await issueAuthToken(user.id, "reset");
    expect(await redeemAuthToken(token, "activation", "blue-whale-42")).toBeNull();
  });

  it("a reset signs out every existing session", async () => {
    const user = await createUser(db, { password: "old-password-1" });
    const s = await createSession(user.id);
    const { token } = await issueAuthToken(user.id, "reset");
    await redeemAuthToken(token, "reset", "new-password-2");
    expect(await validateSessionToken(s.token)).toBeNull();
  });

  it("does not work for a deactivated account and leaves the link unused", async () => {
    const user = await createUser(db, { isActive: false });
    const { token } = await issueAuthToken(user.id, "activation");
    expect(await findValidAuthToken(token, "activation")).toBeNull();
    expect(await redeemAuthToken(token, "activation", "blue-whale-42")).toBeNull();
    await db.update(users).set({ isActive: true }).where(eq(users.id, user.id));
    expect(await findValidAuthToken(token, "activation")).not.toBeNull();
  });
});
