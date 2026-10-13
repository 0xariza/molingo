// spec: specs/account-links.plan.md
// seed: e2e/seed.spec.ts
import { expect, fillNewPassword, messages, test } from "../fixtures";

const t = messages.en.Auth;

test.describe("Activation link", () => {
  test("activation-validates-password", async ({ page, createUser, createAuthToken }) => {
    const user = await createUser({ phone: "+989120000005", displayName: "Nika" });
    await page.goto(`/en/activate/${await createAuthToken(user.id, "activation")}`);
    const submit = page.getByRole("button", { name: t.submitActivate });

    // 1. Submit "short" twice
    await fillNewPassword(page, "short");
    await submit.click();
    await expect(page.getByText(t.errors.too_short)).toBeVisible();

    // 2. Submit "12345678" twice
    await fillNewPassword(page, "12345678");
    await submit.click();
    await expect(page.getByText(t.errors.too_common)).toBeVisible();

    // 3. Submit two different passwords
    await fillNewPassword(page, "brand-new-pass-7", "something-else-1");
    await submit.click();
    await expect(page.getByText(t.errors.mismatch)).toBeVisible();
  });
});
