// spec: specs/auth.plan.md
// seed: e2e/seed.spec.ts
import { expect, formAlert, login, messages, PASSWORD, test } from "../fixtures";

test.describe("Login with mobile number and password", () => {
  test("deactivated-account-cannot-log-in", async ({ page, createUser }) => {
    // 1. Create a deactivated user with a password; log in with it
    await createUser({
      phone: "+989120000008",
      displayName: "Reza",
      password: PASSWORD,
      isActive: false,
    });
    await login(page, "09120000008", PASSWORD);
    await expect(formAlert(page)).toHaveText(messages.en.Auth.errors.invalid);
  });
});
