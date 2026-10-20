// spec: specs/schedule.plan.md
// seed: e2e/seed.spec.ts
import {
  ADMIN,
  dateLabel,
  dayOfWeek,
  expect,
  login,
  logout,
  messages,
  PASSWORD,
  showDay,
  STUDENT,
  test,
} from "../fixtures";

const t = messages.en.Admin.schedule;

test.describe("Moving and cancelling", () => {
  test("cancel-a-session", async ({ page, seedSchedule }) => {
    await seedSchedule();
    const monday = dayOfWeek(2, 1);
    await login(page, ADMIN.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/admin$/);
    await page.goto("/en/admin/schedule?w=1");

    // 1. Open the Monday "Morning A2" card, press "Cancel", give a reason, press "Cancel session"
    await showDay(page, monday);
    await page.getByRole("button", { name: "10:30–12:00 Morning A2" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: t.cancel }).click();
    await dialog.getByRole("textbox", { name: t.reason }).fill("I'm unwell");
    await dialog.getByRole("button", { name: t.confirmCancel }).click();
    const card = page.getByRole("button", { name: `10:30–12:00 ${t.pill.cancelled} Morning A2` });
    await expect(card).toBeVisible();
    await expect(card.getByText("Morning A2")).toHaveCSS("text-decoration-line", "line-through");
    await expect(page.getByText("1:50 of 29 h")).toBeVisible();

    // 2. Log in as Sara, open "My schedule"
    await logout(page);
    await login(page, STUDENT.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/app$/);
    await page.getByRole("link", { name: messages.en.Student.nav.schedule }).click();
    await expect(page.getByRole("region", { name: dateLabel(monday) })).toContainText(
      "Cancelled: “I'm unwell” · not charged",
    );
  });
});
