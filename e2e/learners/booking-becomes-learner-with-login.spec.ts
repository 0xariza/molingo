// spec: specs/learners.plan.md
// seed: e2e/seed.spec.ts
import { ADMIN, expect, login, messages, PASSWORD, test, tomorrowAt } from "../fixtures";

const t = messages.en.Admin.learners;

test.describe("Learners", () => {
  test("booking-becomes-learner-with-login", async ({ page, seedAccounts, createSlot }) => {
    // 1. With a booking by "Nika Rahimi" tomorrow at 18:00, log in as Mona and open the learners
    await seedAccounts();
    await createSlot(tomorrowAt("18:00"), { name: "Nika Rahimi", phone: "+989125551234" });
    await login(page, ADMIN.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/admin$/);
    await page.goto("/en/admin/students");
    await expect(page.getByRole("heading", { name: new RegExp(t.followUps.title) })).toBeVisible();
    await expect(page.getByRole("main").getByText("Nika Rahimi")).toBeVisible();

    // 2. Press "Add Nika Rahimi as a learner"
    await page
      .getByRole("link", { name: t.followUps.addAsLabel.replace("{name}", "Nika Rahimi") })
      .click();
    await expect(page.getByRole("heading", { name: t.form.newTitle })).toBeVisible();
    await expect(page.getByRole("textbox", { name: t.form.fullNameEn })).toHaveValue("Nika Rahimi");
    await expect(page.getByRole("textbox", { name: t.form.phone })).toHaveValue("0912 555 1234");

    // 3. Fill the Persian name, keep "Create their login now" ticked, press "Save learner"
    await page.getByRole("textbox", { name: t.form.fullNameFa }).fill("نیکا رحیمی");
    await expect(
      page.getByRole("checkbox", { name: new RegExp(t.form.createLogin) }),
    ).toBeChecked();
    await page.getByRole("button", { name: t.form.save }).click();
    await expect(page.getByRole("status")).toHaveText(t.form.saved.replace("{name}", "نیکا رحیمی"));
    await expect(page.getByRole("textbox", { name: t.login.linkLabel })).toHaveValue(
      /\/fa\/activate\//,
    );
    await expect(page.getByRole("link", { name: t.login.whatsapp })).toHaveAttribute(
      "href",
      /^https:\/\/wa\.me\/989125551234\?/,
    );

    // 4. Press "Open profile"
    await page.getByRole("link", { name: t.form.openProfile }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nika Rahimi");
    await expect(page.getByText(t.login.state.pending)).toBeVisible();
    await expect(page.getByRole("textbox", { name: t.login.linkLabel })).toHaveCount(0);
  });
});
