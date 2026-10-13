import { describe, expect, it } from "vitest";
import { checkPasswordPolicy, hashPassword, verifyPassword } from "../password";

describe("checkPasswordPolicy", () => {
  it("accepts a reasonable password", () => {
    expect(checkPasswordPolicy("blue-whale-42")).toBeNull();
  });
  it("rejects short, common and repeated passwords", () => {
    expect(checkPasswordPolicy("abc123")).toBe("too_short");
    expect(checkPasswordPolicy("12345678")).toBe("too_common");
    expect(checkPasswordPolicy("Password")).toBe("too_common");
    expect(checkPasswordPolicy("aaaaaaaaaa")).toBe("too_common");
  });
  it("rejects the user's own phone number", () => {
    expect(checkPasswordPolicy("09121234567", "+989121234567")).toBe("too_common");
    expect(checkPasswordPolicy("9121234567", "+989121234567")).toBe("too_common");
  });
});

describe("hashPassword / verifyPassword", () => {
  it("verifies the right password and rejects others or a malformed hash", async () => {
    const hash = await hashPassword("blue-whale-42");
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(hash, "blue-whale-42")).toBe(true);
    expect(await verifyPassword(hash, "blue-whale-43")).toBe(false);
    expect(await verifyPassword("not-a-hash", "blue-whale-42")).toBe(false);
  });
});
