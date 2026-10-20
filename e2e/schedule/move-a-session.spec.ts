// spec: specs/schedule.plan.md
// seed: e2e/seed.spec.ts
import {
  ADMIN,
  dateLabel,
  dayChip,
  dayOfWeek,
  expect,
  login,
  messages,
  PASSWORD,
  showDay,
  test,
} from "../fixtures";

const t = messages.en.Admin.schedule;

test.describe("Moving and cancelling", () => {
  test("move-a-session", async ({ page, seedSchedule }) => {
    await seedSchedule();
    const [monday, wednesday] = [dayOfWeek(2, 1), dayOfWeek(4, 1)];
    await login(page, ADMIN.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/admin$/);
    await page.goto("/en/admin/schedule?w=1");

    // 1. Open the Monday "Morning A2" card
    await showDay(page, monday);
    await page.getByRole("button", { name: "10:30–12:00 Morning A2" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: t.move })).toBeVisible();
    await expect(dialog.getByRole("button", { name: t.cancel })).toBeVisible();

    // 2. Press "Move", pick Wednesday, type "16:00"
    await dialog.getByRole("button", { name: t.move }).click();
    await dialog
      .getByRole("group", { name: t.newDay })
      .getByRole("button", { name: dayChip(wednesday) })
      .click();
    await dialog.getByRole("textbox", { name: t.startTime }).fill("16:00");
    await expect(dialog.getByText("until 17:30")).toBeVisible();
    await expect(dialog.getByRole("status")).toHaveText("You're free. Wed comes to 1:30 of 6 h.");

    // 3. Press "Move session"
    await dialog.getByRole("button", { name: t.confirmMove }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Morning A2/ })).toHaveCount(0);
    await showDay(page, wednesday);
    const moved = page.getByRole("button", { name: `16:00–17:30 Morning A2 ${t.moved}` });
    await expect(moved).toBeVisible();

    // 4. Open it again
    await moved.click();
    await expect(page.getByRole("dialog")).toMatchAriaSnapshot(`
      - term: ${t.facts.movedFrom}
      - definition: ${dateLabel(monday)} · 10:30
    `);
  });
});
