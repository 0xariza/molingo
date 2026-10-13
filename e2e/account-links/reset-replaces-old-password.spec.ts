// spec: specs/account-links.plan.md
// seed: e2e/seed.spec.ts
import {
  expect,
  fillNewPassword,
  formAlert,
  login,
  messages,
  PASSWORD,
  STUDENT,
  test,
} from "../fixtures";

const t = messages.en.Auth;
const NEW_PASSWORD = "brand-new-pass-7";

test.describe("Reset link", () => {
  test("reset-replaces-old-password", async ({ page, seedAccounts, createAuthToken }) => {
    const { studentId } = await seedAccounts();

    // 1. Open Sara's reset link, set a new password
    await page.goto(`/en/reset/${await createAuthToken(studentId, "reset")}`);
    await fillNewPassword(page, NEW_PASSWORD);
    await page.getByRole("button", { name: t.submitReset }).click();
    await expect(page).toHaveURL(/\/en\/app$/);

    // 2. Log out; log in with the old password
    await page.getByRole("button", { name: messages.en.Common.logout }).click();
    await expect(page).toHaveURL(/\/en\/login$/);
    await login(page, STUDENT.local, PASSWORD);
    await expect(formAlert(page)).toHaveText(t.errors.invalid);

    // 3. Log in with the new password
    await login(page, STUDENT.local, NEW_PASSWORD);
    await expect(page).toHaveURL(/\/en\/app$/);
  });
});
