// spec: specs/auth.plan.md
// seed: e2e/seed.spec.ts
import { expect, formAlert, login, messages, STUDENT, test } from "../fixtures";

const t = messages.en.Auth;

test.describe("Login with mobile number and password", () => {
  test("wrong-password-keeps-phone", async ({ page, seedAccounts }) => {
    await seedAccounts();
    // 1. Log in as Sara with a wrong password
    await login(page, STUDENT.local, "not-the-password");
    await expect(formAlert(page)).toHaveText(t.errors.invalid);
    await expect(page.getByLabel(t.phone)).toHaveValue(STUDENT.local);
    await expect(page).toHaveURL(/\/en\/login/);
  });
});
