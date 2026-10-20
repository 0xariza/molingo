// spec: specs/learners.plan.md
// seed: e2e/seed.spec.ts
import { ADMIN, expect, login, messages, PASSWORD, test } from "../fixtures";

const t = messages.fa.Admin;

test.describe("Learners", () => {
  test("persian-learners-page", async ({ page, seedAccounts }) => {
    // 1. Log in as Mona and open /fa/admin/students
    await seedAccounts();
    await login(page, ADMIN.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/admin$/);
    await page.goto("/fa/admin/students");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(t.learners.title);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(
      page
        .getByRole("navigation", { name: messages.fa.Common.areaNav })
        .getByRole("link", { name: t.nav.learners }),
    ).toHaveAttribute("aria-current", "page");
  });
});
