// spec: specs/auth.plan.md
// seed: e2e/seed.spec.ts
import { expect, test } from "../fixtures";

test.describe("Access rules", () => {
  test("forged-session-cookie-is-rejected", async ({ page, context, baseURL }) => {
    // 1. Set a made-up session cookie, open /en/admin
    await context.addCookies([
      { name: "molingo_session", value: "forged-token-value", url: baseURL! },
    ]);
    await page.goto("/en/admin");
    await expect(page).toHaveURL(/\/en\/login$/);
  });
});
