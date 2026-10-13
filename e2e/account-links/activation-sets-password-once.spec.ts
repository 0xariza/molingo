// spec: specs/account-links.plan.md
// seed: e2e/seed.spec.ts
import { expect, fillNewPassword, messages, test } from "../fixtures";

const t = messages.en.Auth;

test.describe("Activation link", () => {
  test("activation-sets-password-once", async ({ page, createUser, createAuthToken }) => {
    // 1. Create user Nika without a password and an activation link; open the link
    const user = await createUser({ phone: "+989120000005", displayName: "Nika" });
    const token = await createAuthToken(user.id, "activation");
    await page.goto(`/en/activate/${token}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Nika");

    // 2. Enter a new password twice, press "Save and continue"
    await fillNewPassword(page, "brand-new-pass-7");
    await page.getByRole("button", { name: t.submitActivate }).click();
    await expect(page).toHaveURL(/\/en\/app$/);

    // 3. Open the same link again
    await page.goto(`/en/activate/${token}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(t.linkInvalidTitle);
  });
});
