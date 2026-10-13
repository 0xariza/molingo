// spec: specs/account-links.plan.md
// seed: e2e/seed.spec.ts
import { expect, messages, test } from "../fixtures";

test.describe("Reset link", () => {
  test("activation-link-is-not-a-reset-link", async ({ page, seedAccounts, createAuthToken }) => {
    const { studentId } = await seedAccounts();
    // 1. Open Sara's activation token on the reset page
    await page.goto(`/en/reset/${await createAuthToken(studentId, "activation")}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      messages.en.Auth.linkInvalidTitle,
    );
  });
});
