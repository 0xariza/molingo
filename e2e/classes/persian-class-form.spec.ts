// spec: specs/classes.plan.md
// seed: e2e/seed.spec.ts
import { ADMIN, expect, login, messages, PASSWORD, test } from "../fixtures";

const t = messages.fa.Admin.classes.form;

test.describe("Classes", () => {
  test("persian-class-form", async ({ page, seedTeaching }) => {
    // 1. Open /fa/admin/classes/new
    await seedTeaching();
    await login(page, ADMIN.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/admin$/);
    await page.goto("/fa/admin/classes/new");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(t.newTitle);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    // 2. Add a day and open "تاریخ شروع"
    await page.getByRole("button", { name: t.addSlot }).click();
    await page.getByRole("button", { name: new RegExp(`^${t.startsOn}`) }).click();
    await expect(page.getByRole("grid")).toHaveAccessibleName(
      /^(فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور|مهر|آبان|آذر|دی|بهمن|اسفند) [۰-۹]{4}$/,
    );
  });
});
