// spec: specs/classes.plan.md
// seed: e2e/seed.spec.ts
import { ADMIN, expect, login, messages, PASSWORD, test } from "../fixtures";

const t = messages.en.Admin.classes;

test.describe("Classes", () => {
  test("class-needs-a-valid-schedule", async ({ page, seedTeaching }) => {
    // 1. Open the new-class form, press "Create class" with nothing filled
    await seedTeaching();
    await login(page, ADMIN.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/admin$/);
    await page.goto("/en/admin/classes/new");
    await page.getByRole("button", { name: t.form.create }).click();
    await expect(page.getByText(t.errors.nameFa)).toBeVisible();
    await expect(page.getByText(t.errors.slots)).toBeVisible();
    await expect(page.getByText(t.errors.startsOn)).toBeVisible();
    await expect(page.getByText(t.errors.price)).toBeVisible();
    await expect(page).toHaveURL(/\/en\/admin\/classes\/new$/);

    // 2. Add a row with the time "25:00"
    await page.getByRole("button", { name: t.form.addSlot }).click();
    const time = page.getByRole("textbox", { name: "Start time on Saturday" });
    await time.fill("25:00");
    await expect(time).toHaveAttribute("aria-invalid", "true");
  });
});
