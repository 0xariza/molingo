// spec: specs/schedule.plan.md
// seed: e2e/seed.spec.ts
import {
  ADMIN,
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
  test("move-is-blocked-by-a-clash", async ({ page, seedSchedule }) => {
    await seedSchedule();
    await login(page, ADMIN.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/admin$/);
    await page.goto("/en/admin/schedule?w=1");

    // 1. Open the Monday "Morning A2" card, press "Move", keep Monday, type "17:30"
    await showDay(page, dayOfWeek(2, 1));
    await page.getByRole("button", { name: "10:30–12:00 Morning A2" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: t.move }).click();
    const time = dialog.getByRole("textbox", { name: t.startTime });
    const confirm = dialog.getByRole("button", { name: t.confirmMove });
    await time.fill("17:30");
    await expect(dialog.getByRole("alert")).toHaveText(
      "Clashes with “Open level-check time” (18:00).",
    );
    await expect(confirm).toBeDisabled();

    // 2. Pick Tuesday, type "17:00"
    await dialog
      .getByRole("group", { name: t.newDay })
      .getByRole("button", { name: dayChip(dayOfWeek(3, 1)) })
      .click();
    await time.fill("17:00");
    await expect(dialog.getByRole("alert")).toHaveText(
      "Clashes with “Level check · Nika Rahimi” (18:00).",
    );

    // 3. Type "16:00"
    await time.fill("16:00");
    await expect(dialog.getByRole("status")).toContainText("You're free.");
    await expect(confirm).toBeEnabled();
  });
});
