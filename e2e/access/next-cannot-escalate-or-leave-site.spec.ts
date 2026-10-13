// spec: specs/auth.plan.md
// seed: e2e/seed.spec.ts
import { ADMIN, expect, login, messages, PASSWORD, STUDENT, test } from "../fixtures";

test.describe("Access rules", () => {
  test("next-cannot-escalate-or-leave-site", async ({ page, seedAccounts }) => {
    await seedAccounts();
    // 1. Log in as Sara via /en/login?next=/admin
    await login(page, STUDENT.local, PASSWORD, "/en/login?next=%2Fadmin");
    await expect(page).toHaveURL(/\/en\/app$/);

    // 2. Log out; log in as Mona via a next= pointing to another site
    await page.getByRole("button", { name: messages.en.Common.logout }).click();
    await expect(page).toHaveURL(/\/en\/login$/);
    await login(page, ADMIN.local, PASSWORD, "/en/login?next=%2F%2Fevil.example");
    await expect(page).toHaveURL(/\/en\/admin$/);
  });
});
