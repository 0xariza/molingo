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

    // 2. Fill the name and tuition, go to the schedule step, add a day and open "تاریخ شروع"
    await page.getByRole("textbox", { name: t.nameFa }).fill("گروه عصر");
    await page.getByRole("textbox", { name: t.priceGroup }).fill("6500000");
    await page.getByRole("button", { name: t.next.path }).click();
    await page.getByRole("button", { name: t.next.schedule }).click();
    await page.getByRole("button", { name: t.addSlot }).click();
    await page.getByRole("button", { name: new RegExp(`^${t.startsOn}`) }).click();
    await expect(page.getByRole("grid")).toHaveAccessibleName(
      /^(فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور|مهر|آبان|آذر|دی|بهمن|اسفند) [۰-۹]{4}$/,
    );
  });
});
