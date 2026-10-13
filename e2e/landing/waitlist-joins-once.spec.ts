// spec: specs/landing.plan.md
// seed: e2e/seed.spec.ts
import { waitlistEmails } from "@/db/schema";
import { expect, messages, test } from "../fixtures";

const t = messages.en.Landing.waitlist;

test.describe("Landing page", () => {
  test("waitlist-joins-once", async ({ page, db }) => {
    // 1. Enter an invalid email, press "Notify me"
    await page.goto("/en");
    await page.getByLabel(t.email).fill("not-an-email");
    await page.getByRole("button", { name: t.submit }).click();
    await expect(page.getByText(t.errors.email)).toBeVisible();

    // 2. Enter a valid email, submit
    await page.getByLabel(t.email).fill("nika@example.com");
    await page.getByRole("button", { name: t.submit }).click();
    await expect(page.getByRole("status")).toHaveText(t.success);

    // 3. Reload and join again with the same email in different case
    await page.reload();
    await page.getByLabel(t.email).fill("Nika@Example.COM");
    await page.getByRole("button", { name: t.submit }).click();
    await expect(page.getByRole("status")).toHaveText(t.success);
    expect(await db.select().from(waitlistEmails)).toHaveLength(1);
  });
});
