// spec: specs/landing.plan.md
// seed: e2e/seed.spec.ts
import { ADMIN, expect, login, messages, PASSWORD, test, tomorrowAt } from "../fixtures";

const t = messages.en;

test.describe("Mona's free-session times", () => {
  test("admin-sees-who-booked", async ({ page, seedAccounts, createSlot }) => {
    // 1. With a booked time, log in as Mona and open /en/admin/level-checks
    await seedAccounts();
    await createSlot(tomorrowAt("18:00"), { name: "Nika Rahimi", phone: "+989125551234" });
    await login(page, ADMIN.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/admin$/);
    await page.goto("/en/admin/level-checks");

    const row = page.getByRole("listitem").filter({ hasText: "Nika Rahimi" });
    await expect(row).toContainText(t.Admin.levelChecks.booked);
    await expect(row).toContainText("+989125551234");
    await expect(row).toContainText(t.Landing.booking.levels.unsure);
    await expect(row.getByRole("button", { name: t.Admin.levelChecks.remove })).toHaveCount(0);
  });
});
