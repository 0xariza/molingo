// spec: specs/auth.plan.md
// seed: e2e/seed.spec.ts
import { expect, messages, PASSWORD, test } from "../fixtures";

const t = messages.fa.Auth;

test.describe("Login with mobile number and password", () => {
  test("persian-digits-are-accepted", async ({ page, seedAccounts }) => {
    await seedAccounts();
    // 1. On /fa/login, type Sara's number in Persian digits and the password
    await page.goto("/fa/login");
    await page.getByLabel(t.phone).fill("۰۹۱۲۰۰۰۰۰۰۲");
    await page.getByLabel(t.password, { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: t.submitLogin }).click();
    await expect(page).toHaveURL(/\/fa\/app$/);
  });
});
