// spec: specs/auth.plan.md
// seed: e2e/seed.spec.ts
import { ADMIN, expect, login, messages, PASSWORD, test } from "../fixtures";

test.describe("Login with mobile number and password", () => {
  test("logout-ends-the-session", async ({ page, seedAccounts }) => {
    await seedAccounts();
    // 1. Log in as Mona, press "Log out"
    await login(page, ADMIN.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/admin$/);
    await page.getByRole("button", { name: messages.en.Common.logout }).click();
    await expect(page).toHaveURL(/\/en\/login$/);

    // 2. Open /en/admin
    await page.goto("/en/admin");
    await expect(page).toHaveURL(/\/en\/login\?next=%2Fadmin$/);
  });
});
