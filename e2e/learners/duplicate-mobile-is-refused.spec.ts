// spec: specs/learners.plan.md
// seed: e2e/seed.spec.ts
import { ADMIN, expect, formAlert, login, messages, PASSWORD, test } from "../fixtures";

const t = messages.en.Admin.learners;

test.describe("Learners", () => {
  test("duplicate-mobile-is-refused", async ({ page, seedAccounts, createLearner }) => {
    // 1. With learner Arash on 0919 450 7781, log in as Mona and open the new-learner form
    await seedAccounts();
    await createLearner({ fullNameFa: "آرش کریمی", phone: "+989194507781" });
    await login(page, ADMIN.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/admin$/);
    await page.goto("/en/admin/students/new");

    // 2. Fill the Persian name and the same mobile in Persian digits, untick the login, save
    await page.getByRole("textbox", { name: t.form.fullNameFa }).fill("آرش دوم");
    await page.getByRole("textbox", { name: t.form.phone }).fill("۰۹۱۹ ۴۵۰ ۷۷۸۱");
    await page.getByRole("checkbox", { name: new RegExp(t.form.createLogin) }).uncheck();
    await page.getByRole("button", { name: t.form.save }).click();
    await expect(formAlert(page)).toContainText(t.errors.phone_taken);
    await expect(formAlert(page).getByRole("link", { name: t.form.openExisting })).toBeVisible();
    await expect(page.getByRole("textbox", { name: t.form.fullNameFa })).toHaveValue("آرش دوم");
  });
});
