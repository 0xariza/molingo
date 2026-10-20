// spec: specs/schedule.plan.md
// seed: e2e/seed.spec.ts
import { ADMIN, dayOfWeek, expect, login, messages, PASSWORD, showDay, test } from "../fixtures";

const t = messages.en.Admin.schedule;

test.describe("Level-check times", () => {
  test("cancel-a-booking-reopens-the-time", async ({ page, seedSchedule }) => {
    await seedSchedule();
    await login(page, ADMIN.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/admin$/);
    await page.goto("/en/admin/schedule?w=1");

    // 1. Open the Tuesday "Nika Rahimi" card, press "Cancel booking", confirm
    await showDay(page, dayOfWeek(3, 1));
    await page.getByRole("button", { name: `18:00–18:20 Nika Rahimi ${t.online}` }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: t.cancelBooking }).click();
    await expect(
      dialog.getByText("Nika Rahimi's booking is cancelled and the time opens again."),
    ).toBeVisible();
    await dialog.getByRole("button", { name: t.cancelBooking }).click();
    const open = page.getByRole("button", { name: `18:00–18:20 ${t.legend.open}` });
    await expect(open).toBeVisible();
    await expect(page.getByText("3:00 of 29 h")).toBeVisible();

    // 2. Open that time
    await open.click();
    await expect(
      dialog
        .getByRole("radiogroup", { name: t.candidates })
        .getByRole("radio", { name: /^N Nika Rahimi/ }),
    ).toBeVisible();

    // 3. Press "Remove this time"
    await dialog.getByRole("button", { name: t.removeSlot }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(open).toHaveCount(0);
  });
});
