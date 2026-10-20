// spec: specs/learners.plan.md
// seed: e2e/seed.spec.ts
import {
  ADMIN,
  expect,
  formAlert,
  login,
  logout,
  messages,
  PASSWORD,
  STUDENT,
  test,
} from "../fixtures";

const t = messages.en.Admin.learners;

test.describe("Learners", () => {
  test("left-turns-login-off", async ({ page, seedTeaching }) => {
    // 1. With Sara as a learner with a login, open her profile as Mona and press "Left"
    const { saraId } = await seedTeaching();
    await login(page, ADMIN.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/admin$/);
    await page.goto(`/en/admin/students/${saraId}`);
    const status = page.getByRole("group", { name: t.profile.statusLabel });
    await status.getByRole("button", { name: t.status.left }).click();
    await expect(status.getByRole("button", { name: t.status.left })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByText(t.login.state.off)).toBeVisible();

    // 2. Log out and log in as Sara
    await logout(page);
    await login(page, STUDENT.local, PASSWORD);
    await expect(formAlert(page)).toHaveText(messages.en.Auth.errors.invalid);

    // 3. As Mona, press "Active" on her profile
    await login(page, ADMIN.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/admin$/);
    await page.goto(`/en/admin/students/${saraId}`);
    await status.getByRole("button", { name: t.status.active }).click();
    await expect(page.getByText(t.login.state.active)).toBeVisible();
  });
});
