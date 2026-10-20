// spec: specs/schedule.plan.md
// seed: e2e/seed.spec.ts
import { ADMIN, dayOfWeek, expect, login, messages, PASSWORD, showDay, test } from "../fixtures";

const t = messages.en.Admin.schedule;

test.describe("Level-check times", () => {
  test("give-an-open-time-to-someone", async ({ page, seedSchedule }) => {
    await seedSchedule();
    await login(page, ADMIN.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/admin$/);
    await page.goto("/en/admin/schedule?w=1");

    // 1. Open the Monday "Open time" card
    await showDay(page, dayOfWeek(2, 1));
    await page.getByRole("button", { name: `18:00–18:20 ${t.legend.open}` }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(t.assignWho)).toBeVisible();
    const waiting = dialog.getByRole("radiogroup", { name: t.candidates });
    await expect(waiting.getByRole("radio", { name: /^M Mahsa/ })).toBeVisible();

    // 2. Search "mah", pick Mahsa, press "Book for Mahsa"
    await dialog.getByRole("searchbox", { name: t.search }).fill("mah");
    await expect(waiting.getByRole("radio", { name: /^M Mahsa/ })).toBeVisible();
    await waiting.getByRole("radio", { name: /^M Mahsa/ }).click();
    await dialog.getByRole("button", { name: "Book for Mahsa" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: `18:00–18:20 Mahsa ${t.manual}` })).toBeVisible();
  });
});
