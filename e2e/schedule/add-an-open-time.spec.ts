// spec: specs/schedule.plan.md
// seed: e2e/seed.spec.ts
import { ADMIN, dayOfWeek, expect, login, messages, PASSWORD, showDay, test } from "../fixtures";

const t = messages.en.Admin.schedule;

test.describe("Level-check times", () => {
  test("add-an-open-time", async ({ page, seedSchedule }) => {
    await seedSchedule();
    await login(page, ADMIN.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/admin$/);
    await page.goto("/en/admin/schedule?w=1");

    // 1. Press "+ Open time" on Thursday, type "11:00", add it
    await showDay(page, dayOfWeek(5, 1));
    await page.getByRole("button", { name: t.addSlotLong }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox", { name: t.startTime }).fill("11:00");
    await expect(dialog.getByText("20 min · until 11:20")).toBeVisible();
    await dialog.getByRole("button", { name: t.addConfirm }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: `11:00–11:20 ${t.legend.open}` })).toBeVisible();

    // 2. Press "+ Open time" on Saturday, type "10:40"
    await showDay(page, dayOfWeek(0, 1));
    await page.getByRole("button", { name: t.addSlotLong }).click();
    await dialog.getByRole("textbox", { name: t.startTime }).fill("10:40");
    await expect(dialog.getByRole("alert")).toHaveText("Clashes with “Morning A2” (10:30).");
    await expect(dialog.getByRole("button", { name: t.addConfirm })).toBeDisabled();

    // 3. Days that have passed have no "+ Open time"
    await page.goto("/en/admin/schedule?w=-1");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(t.prevWeek);
    await expect(page.getByRole("button", { name: t.addSlotLong })).toHaveCount(0);
  });
});
