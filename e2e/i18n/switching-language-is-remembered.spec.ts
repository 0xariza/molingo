// spec: specs/i18n.plan.md
// seed: e2e/seed.spec.ts
import { expect, messages, test } from "../fixtures";

test.describe("Language and direction", () => {
  test("switching-language-is-remembered", async ({ page }) => {
    // 1. Open /fa and press the language switcher
    await page.goto("/fa");
    await page.getByRole("button", { name: messages.fa.Common.switchToLabel }).click();
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(messages.en.Home.title);

    // 2. Open / again
    await page.goto("/");
    await expect(page).toHaveURL(/\/en$/);
  });
});
