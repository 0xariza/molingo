import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { waitlistEmails } from "@/db/schema";
import { resetDb } from "@/test/factories";
import { joinWaitlist, waitlistInputSchema } from "../waitlist";

beforeEach(() => resetDb(db));

describe("waitlist", () => {
  it("rejects invalid addresses", () => {
    expect(waitlistInputSchema.safeParse({ email: "not-an-email", locale: "en" }).success).toBe(
      false,
    );
  });

  it("stores each address once, case-insensitively, without failing on repeats", async () => {
    await joinWaitlist(waitlistInputSchema.parse({ email: "Sara@Example.com", locale: "en" }));
    await joinWaitlist(waitlistInputSchema.parse({ email: "sara@example.com ", locale: "fa" }));
    const rows = await db.select().from(waitlistEmails);
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe("sara@example.com");
  });
});
