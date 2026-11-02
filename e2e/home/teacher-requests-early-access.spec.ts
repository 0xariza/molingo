// spec: specs/home.plan.md
// seed: e2e/seed.spec.ts
import { expect, login, messages, PASSWORD, test } from "../fixtures";

const t = messages.en.Home.start;

test.describe("Platform home page", () => {
  test("teacher-requests-early-access", async ({ page, createUser }) => {
    // 1. Submit the empty form
    await page.goto("/en");
    await page.getByRole("button", { name: t.submit }).click();
    await expect(page.getByText(t.errors.name)).toBeVisible();
    await expect(page.getByText(t.errors.phone)).toBeVisible();
    await expect(page.getByText(t.errors.learners)).toBeVisible();

    // 2. Fill it in
    await page.getByLabel(t.name).fill("Neda");
    await page.getByLabel(t.phone).fill("09125550001");
    await page.getByLabel(t.learners).fill("12");
    await page.getByRole("button", { name: t.submit }).click();
    await expect(page.getByRole("status")).toHaveText(t.success);

    // 3. The owner sees the request
    await createUser({
      phone: "+989120000000",
      role: "owner",
      displayName: "Reza",
      password: PASSWORD,
    });
    await login(page, "09120000000", PASSWORD);
    await expect(page).toHaveURL(/\/en\/owner$/);
    await expect(page.getByText("Neda")).toBeVisible();
    await expect(page.getByText("12 learners now")).toBeVisible();
  });
});
