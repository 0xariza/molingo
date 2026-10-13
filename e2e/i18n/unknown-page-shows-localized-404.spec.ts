// spec: specs/i18n.plan.md
// seed: e2e/seed.spec.ts
import { expect, messages, test } from "../fixtures";

test.describe("Language and direction", () => {
  test("unknown-page-shows-localized-404", async ({ page }) => {
    // 1. Open /fa/does-not-exist
    const response = await page.goto("/fa/does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(messages.fa.NotFound.title);
  });
});
