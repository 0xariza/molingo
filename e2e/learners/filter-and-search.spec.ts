// spec: specs/learners.plan.md
// seed: e2e/seed.spec.ts
import { ADMIN, expect, login, messages, PASSWORD, test } from "../fixtures";

const t = messages.en.Admin.learners;

test.describe("Learners", () => {
  test("filter-and-search", async ({ page, seedTeaching, createLearner }) => {
    // 1. With an active learner Sara and a lead Arash, open the learners as Mona
    await seedTeaching();
    await createLearner({
      fullNameFa: "آرش کریمی",
      fullNameEn: "Arash",
      phone: "+989194507781",
      status: "lead",
    });
    await login(page, ADMIN.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/admin$/);
    await page.goto("/en/admin/students");
    const list = page.getByRole("main");
    await expect(list.getByRole("link", { name: /^Sara/ })).toBeVisible();
    await expect(list.getByRole("link", { name: /^Arash/ })).toBeVisible();
    await expect(page.getByRole("region", { name: t.stats.label })).toMatchAriaSnapshot(`
      - paragraph: ${t.stats.active}
      - paragraph: "1"
    `);

    // 2. Press the "Lead" filter
    const filters = page.getByRole("navigation", { name: t.filters.label });
    await filters.getByRole("link", { name: new RegExp(`^${t.status.lead}`) }).click();
    await expect(page).toHaveURL(/status=lead/);
    await expect(list.getByRole("link", { name: /^Arash/ })).toBeVisible();
    await expect(list.getByRole("link", { name: /^Sara/ })).toHaveCount(0);

    // 3. Press "All", search "۰۹۱۲ ۰۰۰"
    await filters.getByRole("link", { name: new RegExp(`^${t.filters.all}`) }).click();
    await page.getByRole("searchbox", { name: t.filters.search }).fill("۰۹۱۲ ۰۰۰");
    await page.getByRole("button", { name: t.filters.submit }).click();
    await expect(list.getByRole("link", { name: /^Sara/ })).toBeVisible();
    await expect(list.getByRole("link", { name: /^Arash/ })).toHaveCount(0);
  });
});
