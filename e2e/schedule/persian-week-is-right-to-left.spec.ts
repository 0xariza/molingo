// spec: specs/schedule.plan.md
// seed: e2e/seed.spec.ts
import { ADMIN, expect, login, messages, PASSWORD, test } from "../fixtures";

const t = messages.fa.Admin.schedule;

test.describe("Week calendar", () => {
  test("persian-week-is-right-to-left", async ({ page, seedSchedule }) => {
    // 1. Open /fa/admin/schedule?w=1
    await seedSchedule();
    await login(page, ADMIN.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/admin$/);
    await page.goto("/fa/admin/schedule?w=1");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(t.nextWeek);
    const days = page.getByRole("group", { name: t.days }).getByRole("button");
    await expect(days.first()).toHaveAccessibleName(/^شنبه /);
    const saturday = (await days.first().boundingBox())!;
    const friday = (await days.last().boundingBox())!;
    expect(saturday.x).toBeGreaterThan(friday.x);
    await expect(page.getByRole("button", { name: /^۱۰:۳۰ تا ۱۲:۰۰ / })).toBeVisible();
  });
});
