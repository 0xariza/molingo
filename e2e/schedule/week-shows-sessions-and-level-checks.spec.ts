// spec: specs/schedule.plan.md
// seed: e2e/seed.spec.ts
import { ADMIN, dayOfWeek, expect, login, messages, PASSWORD, showDay, test } from "../fixtures";

const t = messages.en.Admin.schedule;

test.describe("Week calendar", () => {
  test("week-shows-sessions-and-level-checks", async ({ page, seedSchedule }) => {
    // 1. Log in as Mona, open "Weekly schedule" from the menu
    await seedSchedule();
    await login(page, ADMIN.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/admin$/);
    await page
      .getByRole("navigation", { name: messages.en.Common.areaNav })
      .getByRole("link", { name: new RegExp(`^${t.title}`) })
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(t.thisWeek);
    await expect(
      page.getByText(/^\d{1,2} [A-Z][a-z]{2}( \d{4})? – \d{1,2} [A-Z][a-z]{2} \d{4}$/),
    ).toBeVisible();

    // 2. Press the next-week arrow
    await page.getByRole("link", { name: t.nextWeek }).click();
    await expect(page).toHaveURL(/\?w=1$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(t.nextWeek);

    // 3. Look at Saturday, Monday and Tuesday
    await showDay(page, dayOfWeek(0, 1));
    await expect(page.getByRole("button", { name: "10:30–12:00 Morning A2" })).toBeVisible();
    await showDay(page, dayOfWeek(2, 1));
    await expect(page.getByRole("button", { name: "10:30–12:00 Morning A2" })).toBeVisible();
    await expect(page.getByRole("button", { name: `18:00–18:20 ${t.legend.open}` })).toBeVisible();
    await showDay(page, dayOfWeek(3, 1));
    await expect(
      page.getByRole("button", { name: `18:00–18:20 Nika Rahimi ${t.online}` }),
    ).toBeVisible();

    // 4. Read the hours panel: two 90-minute sessions and one booked level check
    await expect(page.getByText("3:20 of 29 h")).toBeVisible();

    // 5. Press "This week"
    await page.getByRole("link", { name: t.thisWeek }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(t.thisWeek);
  });
});
