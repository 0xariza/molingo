// spec: specs/auth.plan.md
// seed: e2e/seed.spec.ts
import { expect, login, PASSWORD, STUDENT, test } from "../fixtures";

test.describe("Access rules", () => {
  test("student-cannot-open-admin", async ({ page, seedAccounts }) => {
    await seedAccounts();
    // 1. Log in as Sara, then open /en/admin
    await login(page, STUDENT.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/app$/);
    await page.goto("/en/admin");
    await expect(page).toHaveURL(/\/en\/app$/);
  });
});
