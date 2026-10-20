// spec: specs/classes.plan.md
// seed: e2e/seed.spec.ts
import { ADMIN, dayOfWeek, expect, login, messages, PASSWORD, test } from "../fixtures";

const t = messages.en.Admin.classes;

test.describe("Classes", () => {
  test("add-learner-from-card", async ({ page, seedTeaching, createLearner, createClass }) => {
    // 1. With a group class for 2 and learners Sara and Arash, press "Add a learner to Morning A2"
    const { teacherId } = await seedTeaching();
    await createLearner({ fullNameFa: "آرش کریمی", fullNameEn: "Arash", phone: "+989194507781" });
    await createClass({
      teacherId,
      capacity: 2,
      startsOn: dayOfWeek(0, 1),
      slots: [{ weekday: 0, time: "10:30" }],
    });
    await login(page, ADMIN.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/admin$/);
    await page.goto("/en/admin/classes");
    await page
      .getByRole("button", { name: t.card.addLabel.replace("{name}", "Morning A2") })
      .click();
    const dialog = page.getByRole("dialog");
    const search = dialog.getByRole("combobox", { name: t.detail.addLearner });
    await expect(search).toBeVisible();

    // 2. Type "0919", pick Arash, press "Add to class"
    await search.fill("0919");
    await expect(dialog.getByRole("option")).toHaveCount(1);
    await dialog.getByRole("option", { name: /^Arash/ }).click();
    await dialog.getByRole("button", { name: t.detail.addButton }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page
        .getByRole("listitem")
        .filter({ hasText: "Morning A2" })
        .filter({ hasText: /of \d seats/ }),
    ).toContainText("1 of 2 seats");
  });
});
