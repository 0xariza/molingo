// spec: specs/i18n.plan.md
// seed: e2e/seed.spec.ts
import { expect, messages, test } from "../fixtures";

test.describe("Language and direction", () => {
  test("persian-is-the-default", async ({ page }) => {
    // 1. Open /
    await page.goto("/");
    await expect(page).toHaveURL(/\/fa$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "fa");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      messages.fa.Landing.hero.title1,
    );
  });
});
