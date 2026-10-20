// spec: specs/schedule.plan.md
// seed: e2e/seed.spec.ts
import { ADMIN, dayOfWeek, expect, login, messages, PASSWORD, showDay, test } from "../fixtures";

const t = messages.en.Admin.schedule;

test.describe("Level-check times", () => {
  test("book-for-someone-new", async ({ page, seedSchedule }) => {
    await seedSchedule();
    await login(page, ADMIN.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/admin$/);
    await page.goto("/en/admin/schedule?w=1");

    // 1. Open the Monday "Open time" card, pick "Someone new", type "Sina" and "123"
    await showDay(page, dayOfWeek(2, 1));
    await page.getByRole("button", { name: `18:00–18:20 ${t.legend.open}` }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("radio", { name: new RegExp(`^${t.newPerson}`) }).click();
    await dialog.getByRole("textbox", { name: t.name }).fill("Sina");
    const phone = dialog.getByRole("textbox", { name: t.phone });
    await phone.fill("123");
    await dialog.getByRole("button", { name: "Book for Sina" }).click();
    await expect(dialog.getByText(t.errors.phone)).toBeVisible();
    await expect(phone).toHaveValue("123");

    // 2. Type a valid mobile, press "Book for Sina"
    await phone.fill("09352104417");
    await dialog.getByRole("button", { name: "Book for Sina" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: `18:00–18:20 Sina ${t.manual}` })).toBeVisible();
  });
});
