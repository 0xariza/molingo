// spec: specs/landing.plan.md
// seed: e2e/seed.spec.ts
import { formatDate, tehranDateKey } from "@/lib/format";
import { ADMIN, expect, login, messages, PASSWORD, test, tomorrowAt } from "../fixtures";

const t = messages.en.Admin;

test.describe("Mona's free-session times", () => {
  test("admin-adds-and-removes-a-time", async ({ page, seedAccounts }) => {
    await seedAccounts();
    const tomorrow = tomorrowAt("18:30");
    const when = `${formatDate(tomorrow, "en", { year: false })} · 18:30`;

    // 1. Log in as Mona, open "Free sessions" from the panel menu
    await login(page, ADMIN.local, PASSWORD);
    await page.getByRole("link", { name: t.nav.levelChecks, exact: true }).click();
    await expect(page.getByText(t.levelChecks.empty)).toBeVisible();

    // 2. Choose tomorrow, enter 18:30, press "Add"
    await page.getByLabel(t.levelChecks.date).selectOption(tehranDateKey(tomorrow));
    await page.getByLabel(t.levelChecks.time).fill("18:30");
    await page.getByRole("button", { name: t.levelChecks.add }).click();
    await expect(page.getByRole("status")).toHaveText(t.levelChecks.added);
    await expect(page.getByRole("listitem").filter({ hasText: when })).toContainText(
      t.levelChecks.free,
    );

    // 3. Add the same time again
    await page.getByLabel(t.levelChecks.time).fill("18:30");
    await page.getByRole("button", { name: t.levelChecks.add }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(
      t.levelChecks.errors.overlap,
    );

    // 4. Remove it
    await page.getByRole("button", { name: `Remove ${when}` }).click();
    await expect(page.getByText(t.levelChecks.empty)).toBeVisible();
  });
});
