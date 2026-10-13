// spec: specs/auth.plan.md
// seed: e2e/seed.spec.ts
import { ADMIN, expect, messages, PASSWORD, test } from "../fixtures";

const t = messages.en.Auth;

test.describe("Access rules", () => {
  test("protected-page-returns-after-login", async ({ page, seedAccounts }) => {
    await seedAccounts();
    // 1. Open /en/admin while logged out
    await page.goto("/en/admin");
    await expect(page).toHaveURL(/\/en\/login\?next=%2Fadmin$/);

    // 2. Log in as Mona on that page
    await page.getByLabel(t.phone).fill(ADMIN.local);
    await page.getByLabel(t.password, { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: t.submitLogin }).click();
    await expect(page).toHaveURL(/\/en\/admin$/);
  });
});
