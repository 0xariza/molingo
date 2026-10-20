// spec: specs/classes.plan.md
// seed: e2e/seed.spec.ts
import { ADMIN, dayOfWeek, expect, login, messages, PASSWORD, test } from "../fixtures";

const t = messages.en.Admin.classes;
const tl = messages.en.Admin.learners.classes;

test.describe("Classes", () => {
  test("move-learner-to-another-class", async ({ page, seedTeaching, createClass }) => {
    // 1. With Sara in class A and a class B with a free seat, move her to B
    const { teacherId, saraId } = await seedTeaching();
    const a = await createClass({
      teacherId,
      startsOn: dayOfWeek(0, 1),
      slots: [{ weekday: 0, time: "10:30" }],
      studentIds: [saraId],
    });
    await createClass({
      teacherId,
      nameEn: "Evening B1",
      level: "B1",
      startsOn: dayOfWeek(1, 1),
      slots: [{ weekday: 1, time: "17:00" }],
    });
    await login(page, ADMIN.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/admin$/);
    await page.goto(`/en/admin/classes/${a.id}`);
    await page.getByRole("button", { name: t.detail.moveLabel.replace("{name}", "Sara") }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("radio", { name: /Evening B1/ }).click();
    await dialog.getByRole("button", { name: t.move.confirm }).click();
    await expect(
      page.getByRole("button", { name: t.detail.moveLabel.replace("{name}", "Sara") }),
    ).toHaveCount(0);

    await page.goto(`/en/admin/students/${saraId}`);
    await expect(
      page.getByRole("link", { name: new RegExp(`Evening B1.*${tl.inClass}`) }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: new RegExp(`Morning A2.*${tl.ended}`) }),
    ).toBeVisible();
  });
});
