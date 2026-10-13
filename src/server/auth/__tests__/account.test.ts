import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createUser, resetDb } from "@/test/factories";
import { recordLogin, setPreferredLocale } from "../account";

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
