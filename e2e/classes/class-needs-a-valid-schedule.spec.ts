// spec: specs/classes.plan.md
// seed: e2e/seed.spec.ts
import { ADMIN, expect, login, messages, PASSWORD, test } from "../fixtures";

const t = messages.en.Admin.classes;

test.describe("Classes", () => {
  test("class-needs-a-valid-schedule", async ({ page, seedTeaching }) => {
    // 1. Open the new-class form: "Next" waits for the name and tuition
    await seedTeaching();
    await login(page, ADMIN.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/admin$/);
    await page.goto("/en/admin/classes/new");
    await expect(page.getByRole("button", { name: t.form.next.path })).toBeDisabled();
    await expect(page.getByText(t.form.need.class)).toBeVisible();

    // 2. Fill them, skip the path: "Next" waits for a day, a time and a start date
    await page.getByRole("textbox", { name: t.form.nameFa }).fill("کلاس عصر");
    await page.getByRole("textbox", { name: t.form.priceGroup }).fill("6500000");
    await page.getByRole("button", { name: t.form.next.path }).click();
    await page.getByRole("button", { name: t.form.next.schedule }).click();
    await expect(page.getByRole("button", { name: t.form.next.learners })).toBeDisabled();
    await expect(page.getByText(t.form.need.schedule)).toBeVisible();

    // 3. Add a row with the time "25:00"
    await page.getByRole("button", { name: t.form.addSlot }).click();
    const time = page.getByRole("textbox", { name: "Start time on Saturday" });
    await time.fill("25:00");
    await expect(time).toHaveAttribute("aria-invalid", "true");
  });
});
