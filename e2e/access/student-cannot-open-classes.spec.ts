// spec: specs/classes.plan.md
// seed: e2e/seed.spec.ts
import { expect, login, PASSWORD, STUDENT, test } from "../fixtures";

test.describe("Classes", () => {
  test("student-cannot-open-classes", async ({ page, seedAccounts }) => {
    // 1. Log in as Sara (student), open /en/admin/classes
    await seedAccounts();
    await login(page, STUDENT.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/app$/);
    await page.goto("/en/admin/classes");
    await expect(page).toHaveURL(/\/en\/app$/);
  });
});
