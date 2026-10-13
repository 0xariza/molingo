// spec: specs/auth.plan.md
// seed: e2e/seed.spec.ts
import { ADMIN, expect, login, PASSWORD, test } from "../fixtures";

test.describe("Login with mobile number and password", () => {
  test("admin-logs-in", async ({ page, seedAccounts }) => {
    await seedAccounts();
    // 1. Enter Mona's number and password, press "Log in"
    await login(page, ADMIN.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/admin$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(ADMIN.name);
  });
});
