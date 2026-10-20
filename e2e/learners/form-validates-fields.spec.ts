// spec: specs/learners.plan.md
// seed: e2e/seed.spec.ts
import { ADMIN, expect, login, messages, PASSWORD, test } from "../fixtures";

const t = messages.en.Admin.learners;

test.describe("Learners", () => {
  test("form-validates-fields", async ({ page, seedAccounts }) => {
    // 1. Log in as Mona, open the new-learner form, press "Save learner" with empty fields
    await seedAccounts();
    await login(page, ADMIN.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/admin$/);
    await page.goto("/en/admin/students/new");
    await page.getByRole("button", { name: t.form.save }).click();
    await expect(page.getByText(t.errors.fullNameFa)).toBeVisible();
    await expect(page.getByText(t.errors.phone)).toBeVisible();
    await expect(page.getByRole("textbox", { name: t.form.fullNameFa })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(page).toHaveURL(/\/en\/admin\/students\/new$/);
  });
});
