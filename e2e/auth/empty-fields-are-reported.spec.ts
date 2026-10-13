// spec: specs/auth.plan.md
// seed: e2e/seed.spec.ts
import { expect, messages, test } from "../fixtures";

const t = messages.en.Auth;

test.describe("Login with mobile number and password", () => {
  test("empty-fields-are-reported", async ({ page }) => {
    // 1. Press "Log in" with empty fields
    await page.goto("/en/login");
    await page.getByRole("button", { name: t.submitLogin }).click();
    await expect(page.getByText(t.errors.required)).toBeVisible();
    await expect(page.getByLabel(t.phone)).toHaveAttribute("aria-invalid", "true");
  });
});
