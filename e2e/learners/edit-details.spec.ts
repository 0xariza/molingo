// spec: specs/learners.plan.md
// seed: e2e/seed.spec.ts
import { ADMIN, expect, login, messages, PASSWORD, test } from "../fixtures";

const t = messages.en.Admin.learners;

test.describe("Learners", () => {
  test("edit-details", async ({ page, seedTeaching }) => {
    // 1. Open Sara's profile as Mona, press "Edit details", change the English name, save
    const { saraId } = await seedTeaching();
    await login(page, ADMIN.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/admin$/);
    await page.goto(`/en/admin/students/${saraId}`);
    await page.getByRole("link", { name: t.profile.edit }).click();
    await expect(page.getByRole("heading", { name: t.form.editTitle })).toBeVisible();
    await page.getByRole("textbox", { name: t.form.fullNameEn }).fill("Sara A.");
    await page.getByRole("button", { name: t.form.saveChanges }).click();
    await expect(page).toHaveURL(new RegExp(`/en/admin/students/${saraId}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sara A.");
  });
});
