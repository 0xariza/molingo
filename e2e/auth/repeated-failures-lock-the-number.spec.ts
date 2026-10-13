// spec: specs/auth.plan.md
// seed: e2e/seed.spec.ts
import { expect, formAlert, login, messages, PASSWORD, STUDENT, test } from "../fixtures";

const t = messages.en.Auth;

test.describe("Login with mobile number and password", () => {
  test("repeated-failures-lock-the-number", async ({ page, seedAccounts }) => {
    await seedAccounts();
    // 1. Fail to log in as Sara five times
    for (let i = 0; i < 5; i++) {
      await login(page, STUDENT.local, `wrong-${i}`);
      await expect(formAlert(page)).toHaveText(t.errors.invalid);
    }
    // 2. Log in with the correct password
    await login(page, STUDENT.local, PASSWORD);
    await expect(formAlert(page)).toHaveText(t.errors.rate_limited);
  });
});
