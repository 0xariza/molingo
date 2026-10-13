// spec: specs/auth.plan.md
// seed: e2e/seed.spec.ts
import { expect, formAlert, login, messages, PASSWORD, test } from "../fixtures";

test.describe("Login with mobile number and password", () => {
  test("unknown-number-same-error", async ({ page, seedAccounts }) => {
    await seedAccounts();
    // 1. Log in with an unregistered number
    await login(page, "09129999999", PASSWORD);
    await expect(formAlert(page)).toHaveText(messages.en.Auth.errors.invalid);
  });
});
