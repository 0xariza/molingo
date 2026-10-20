// spec: specs/learners.plan.md
// seed: e2e/seed.spec.ts
import { expect, login, PASSWORD, STUDENT, test } from "../fixtures";

test.describe("Learners", () => {
  test("student-cannot-open-learners", async ({ page, seedAccounts }) => {
    // 1. Log in as Sara (student), open /en/admin/students
    await seedAccounts();
    await login(page, STUDENT.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/app$/);
    await page.goto("/en/admin/students");
    await expect(page).toHaveURL(/\/en\/app$/);
  });
});
