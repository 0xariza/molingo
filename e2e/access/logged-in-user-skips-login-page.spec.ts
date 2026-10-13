// spec: specs/auth.plan.md
// seed: e2e/seed.spec.ts
import { ADMIN, expect, login, PASSWORD, test } from "../fixtures";

test.describe("Access rules", () => {
  test("logged-in-user-skips-login-page", async ({ page, seedAccounts }) => {
    await seedAccounts();
    // 1. Log in as Mona, then open /en/login
    await login(page, ADMIN.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/admin$/);
    await page.goto("/en/login");
    await expect(page).toHaveURL(/\/en\/admin$/);
  });
});
