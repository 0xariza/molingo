// spec: specs/learners.plan.md
// seed: e2e/seed.spec.ts
import { ADMIN, expect, login, logout, messages, PASSWORD, test } from "../fixtures";

const t = messages.en.Admin.learners.login;
const auth = messages.fa.Auth;

test.describe("Learners", () => {
  test("activation-link-from-profile-works", async ({ page, seedAccounts, createLearner }) => {
    // 1. With learner Arash (no login), log in as Mona and open his profile
    await seedAccounts();
    const arash = await createLearner({
      fullNameFa: "آرش کریمی",
      fullNameEn: "Arash",
      phone: "+989194507781",
    });
    await login(page, ADMIN.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/admin$/);
    await page.goto(`/en/admin/students/${arash.id}`);
    await expect(page.getByText(t.state.none)).toBeVisible();

    // 2. Press "Create login"; read the link
    await page.getByRole("button", { name: t.create }).click();
    const link = page.getByRole("textbox", { name: t.linkLabel });
    await expect(link).toHaveValue(/\/fa\/activate\//);
    const url = new URL(await link.inputValue());

    // 3. Log out, open the link (in Persian, his language), set a password twice, save
    await logout(page);
    await page.goto(url.pathname);
    await page.getByRole("textbox", { name: auth.newPassword }).fill("arash-pass-2026");
    await page.getByRole("textbox", { name: auth.confirmPassword }).fill("arash-pass-2026");
    await page.getByRole("button", { name: auth.submitActivate }).click();
    await expect(page).toHaveURL(/\/fa\/app$/);
  });
});
