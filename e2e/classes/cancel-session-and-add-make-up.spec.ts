// spec: specs/classes.plan.md
// seed: e2e/seed.spec.ts
import { ADMIN, dayOfWeek, expect, login, messages, PASSWORD, pickDate, test } from "../fixtures";

const t = messages.en.Admin.classes;

test.describe("Classes", () => {
  test("cancel-session-and-add-make-up", async ({ page, seedTeaching, createClass }) => {
    // 1. On a class page, cancel session 1 with a reason
    const { teacherId, saraId } = await seedTeaching();
    const cls = await createClass({
      teacherId,
      startsOn: dayOfWeek(0, 1),
      slots: [
        { weekday: 0, time: "10:30" },
        { weekday: 2, time: "10:30" },
      ],
      studentIds: [saraId],
    });
    await login(page, ADMIN.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/admin$/);
    await page.goto(`/en/admin/classes/${cls.id}`);
    const first = page.getByRole("main").getByRole("listitem").first();
    await first.getByRole("button", { name: t.detail.cancel }).click();
    await page.getByRole("textbox", { name: t.cancel.reason }).fill("Holiday");
    await page.getByRole("dialog").getByRole("button", { name: t.cancel.confirm }).click();
    await expect(first).toContainText(t.detail.phase.cancelled);
    await expect(first).toContainText("Cancelled by you: “Holiday” · not charged");

    // 2. Press "Add replacement"
    await first.getByRole("link", { name: t.detail.replace }).click();
    await expect(page.getByRole("heading", { name: t.makeup.title })).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: new RegExp(`^${t.makeup.replaces}`) }),
    ).toContainText("Session 1 · cancelled");

    // 3. Pick next Monday at a time that overlaps the class, then a free one, and add it
    await page.getByRole("button", { name: new RegExp(`^${t.makeup.day} `) }).click();
    await pickDate(page, dayOfWeek(2, 1));
    const time = page.getByRole("textbox", { name: t.makeup.time });
    await time.fill("11:00");
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "Clashes with Morning A2",
    );
    await time.fill("14:00");
    await expect(page.getByText(/You're free: /)).toBeVisible();
    await page.getByRole("button", { name: t.makeup.save }).click();
    await expect(page).toHaveURL(new RegExp(`/en/admin/classes/${cls.id}$`));
    await expect(page.getByText("Make-up for session 1")).toBeVisible();
    await expect(page.getByRole("link", { name: t.detail.replace })).toHaveCount(0);
  });
});
