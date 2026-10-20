// spec: specs/classes.plan.md
// seed: e2e/seed.spec.ts
import { ADMIN, dayOfWeek, expect, login, messages, PASSWORD, test } from "../fixtures";

const t = messages.en.Admin.classes;

test.describe("Classes", () => {
  test("mark-session-held-with-attendance", async ({
    page,
    seedTeaching,
    createLearner,
    createClass,
  }) => {
    // 1. With a class whose first session has ended and two learners, open the class page
    const { teacherId, saraId } = await seedTeaching();
    const arash = await createLearner({ fullNameFa: "آرش کریمی", fullNameEn: "Arash" });
    const cls = await createClass({
      teacherId,
      nameEn: "Evening B1",
      level: "B1",
      sessionCount: 4,
      startsOn: dayOfWeek(1, -2),
      slots: [{ weekday: 1, time: "17:00" }],
      studentIds: [saraId, arash.id],
    });
    await login(page, ADMIN.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/admin$/);
    await page.goto(`/en/admin/classes/${cls.id}`);
    const first = page.getByRole("main").getByRole("listitem").first();
    await expect(first).toContainText(t.detail.phase.ended);

    // 2. Press "Mark as held", set Arash to "Excused", confirm
    await first.getByRole("button", { name: t.detail.markHeld }).click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("group", { name: t.attendance.group.replace("{name}", "Arash") })
      .getByRole("button", { name: t.attendance.excused })
      .click();
    await expect(dialog.getByText("Charged for this session: 1 of 2")).toBeVisible();
    await dialog.getByRole("button", { name: t.attendance.confirm }).click();
    await expect(first).toContainText("1 present · 0 absent (charged) · 1 excused");
    await expect(first).toContainText(t.detail.phase.held);
  });
});
