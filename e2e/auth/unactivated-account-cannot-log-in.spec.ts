// spec: specs/auth.plan.md
// seed: e2e/seed.spec.ts
import { expect, formAlert, login, messages, test } from "../fixtures";

test.describe("Login with mobile number and password", () => {
  test("unactivated-account-cannot-log-in", async ({ page, createUser }) => {
    // 1. Create a user without a password; try to log in
    await createUser({ phone: "+989120000009", displayName: "Ali" });
    await login(page, "09120000009", "any-password-1");
    await expect(formAlert(page)).toHaveText(messages.en.Auth.errors.invalid);
  });
});
