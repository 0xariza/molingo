import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { authSessions, users } from "@/db/schema";
import { createUser, resetDb } from "@/test/factories";
import { hashToken } from "../crypto";
import { createSession, invalidateSession, validateSessionToken } from "../sessions";

beforeEach(() => resetDb(db));

describe("sessions", () => {
  it("validates, then rejects after logout", async () => {
    const user = await createUser(db, { password: "blue-whale-42" });
    const { token } = await createSession(user.id);
    expect((await validateSessionToken(token))?.id).toBe(user.id);
    await invalidateSession(token);
    expect(await validateSessionToken(token)).toBeNull();
  });

  it("stores only a hash of the token", async () => {
    const user = await createUser(db);
    const { token } = await createSession(user.id);
    const rows = await db.select().from(authSessions);
    expect(rows[0].id).toBe(hashToken(token));
    expect(rows[0].id).not.toBe(token);
  });

  it("rejects expired sessions and extends ones past halfway", async () => {
    const user = await createUser(db);
    const expired = await createSession(user.id);
    const old = await createSession(user.id);
    await db
      .update(authSessions)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(authSessions.id, hashToken(expired.token)));
    const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    await db
      .update(authSessions)
      .set({ expiresAt: soon })
      .where(eq(authSessions.id, hashToken(old.token)));

    expect(await validateSessionToken(expired.token)).toBeNull();
    expect(await validateSessionToken(old.token)).not.toBeNull();
    const [renewed] = await db
      .select()
      .from(authSessions)
      .where(eq(authSessions.id, hashToken(old.token)));
    expect(renewed.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000);
  });

  it("drops sessions of deactivated users", async () => {
    const user = await createUser(db);
    const { token } = await createSession(user.id);
    await db.update(users).set({ isActive: false }).where(eq(users.id, user.id));
    expect(await validateSessionToken(token)).toBeNull();
  });
});
