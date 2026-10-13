// spec: specs/i18n.plan.md
// seed: e2e/seed.spec.ts
import { expect, messages, test } from "../fixtures";

test.describe("Language and direction", () => {
  test("skip-link-for-keyboard-users", async ({ page, browserName }) => {
    test.skip(browserName === "webkit", "WebKit does not Tab-focus links by default");
    // 1. Open /en and press Tab once
    await page.goto("/en");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: messages.en.Common.skipToContent })).toBeFocused();
  });
});
