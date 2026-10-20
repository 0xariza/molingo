// spec: specs/classes.plan.md
// seed: e2e/seed.spec.ts
import { ADMIN, dayOfWeek, expect, login, messages, PASSWORD, test } from "../fixtures";

const t = messages.en.Admin.classes;

test.describe("Classes", () => {
  test("full-class-takes-nobody", async ({ page, seedTeaching, createLearner, createClass }) => {
    // 1. With a full group class, open its page and then the class list
    const { teacherId, saraId } = await seedTeaching();
    const arash = await createLearner({ fullNameFa: "آرش کریمی", fullNameEn: "Arash" });
    const cls = await createClass({
      teacherId,
      capacity: 2,
      startsOn: dayOfWeek(0, 1),
      slots: [{ weekday: 0, time: "10:30" }],
      studentIds: [saraId, arash.id],
    });
    await login(page, ADMIN.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/admin$/);
    await page.goto(`/en/admin/classes/${cls.id}`);
    await expect(page.getByText(t.detail.full)).toBeVisible();
    await expect(page.getByRole("combobox", { name: t.detail.addLearner })).toHaveCount(0);

    await page.goto("/en/admin/classes");
    await expect(
      page
        .getByRole("listitem")
        .filter({ hasText: "Morning A2" })
        .filter({ hasText: /of \d seats/ }),
    ).toContainText(t.card.classFull);
  });
});
