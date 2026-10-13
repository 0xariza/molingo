// spec: specs/account-links.plan.md
// seed: e2e/seed.spec.ts
import { expect, messages, test } from "../fixtures";

const t = messages.en.Auth;

test.describe("Activation link", () => {
  test("expired-or-made-up-link-is-refused", async ({ page, createUser, createAuthToken }) => {
    // 1. Open an activation link that expired a second ago
    const user = await createUser({ phone: "+989120000005", displayName: "Nika" });
    const expired = await createAuthToken(user.id, "activation", new Date(Date.now() - 1000));
    await page.goto(`/en/activate/${expired}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(t.linkInvalidTitle);

    // 2. Open a made-up link
    await page.goto(`/en/activate/${"x".repeat(43)}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(t.linkInvalidTitle);
  });
});
