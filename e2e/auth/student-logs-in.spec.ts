// spec: specs/auth.plan.md
// seed: e2e/seed.spec.ts
import { expect, login, PASSWORD, STUDENT, test } from "../fixtures";

test.describe("Login with mobile number and password", () => {
  test("student-logs-in", async ({ page, seedAccounts }) => {
    await seedAccounts();
    // 1. Enter Sara's number and password, press "Log in"
    await login(page, STUDENT.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/app$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(STUDENT.name);
  });
});
