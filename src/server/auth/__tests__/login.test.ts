import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { createUser, resetDb } from "@/test/factories";
import { authenticate, LOGIN_LIMITS } from "../login";

beforeEach(() => resetDb(db));

describe("authenticate", () => {
  it("logs in with any spelling of the phone number", async () => {
    await createUser(db, { password: "blue-whale-42" });
    for (const phone of ["09121234567", "۰۹۱۲ ۱۲۳ ۴۵۶۷", "+989121234567"]) {
      const r = await authenticate(phone, "blue-whale-42", "1.1.1.1");
      expect(r.ok).toBe(true);
    }
  });

  it("returns the same error for a wrong password, unknown phone, unactivated or inactive user", async () => {
    await createUser(db, { password: "blue-whale-42" });
    await createUser(db, { phone: "+989121111111" }); // no password yet
    await createUser(db, { phone: "+989122222222", password: "blue-whale-42", isActive: false });
    const cases = [
      ["09121234567", "wrong-password"],
      ["09129999999", "blue-whale-42"],
      ["09121111111", "anything-at-all"],
      ["09122222222", "blue-whale-42"],
    ];
    for (const [phone, pw] of cases) {
      expect(await authenticate(phone, pw, `ip-${phone}`)).toEqual({ ok: false, error: "invalid" });
    }
  });

  it("locks a phone number after too many attempts, even with the right password", async () => {
    await createUser(db, { password: "blue-whale-42" });
    for (let i = 0; i < LOGIN_LIMITS.perPhone; i++) {
      await authenticate("09121234567", "wrong-password", `ip-${i}`);
    }
    const r = await authenticate("09121234567", "blue-whale-42", "ip-x");
    expect(r).toEqual({ ok: false, error: "rate_limited" });
  });

  it("clears the per-phone counter after a successful login", async () => {
    await createUser(db, { password: "blue-whale-42" });
    for (let i = 0; i < LOGIN_LIMITS.perPhone - 1; i++) {
      await authenticate("09121234567", "wrong-password", "ip");
    }
    expect((await authenticate("09121234567", "blue-whale-42", "ip")).ok).toBe(true);
    expect((await authenticate("09121234567", "wrong-password", "ip")).ok).toBe(false);
    expect((await authenticate("09121234567", "blue-whale-42", "ip")).ok).toBe(true);
  });
});
