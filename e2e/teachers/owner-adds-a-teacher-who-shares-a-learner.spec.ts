// spec: specs/teachers.plan.md
// seed: e2e/seed.spec.ts
import {
  ADMIN,
  expect,
  fillNewPassword,
  login,
  messages,
  PASSWORD,
  STUDENT,
  test,
} from "../fixtures";

const t = messages.en;

test.describe("Two teachers", () => {
  test("owner-adds-a-teacher-who-shares-a-learner", async ({
    page,
    browser,
    createUser,
    seedTeaching,
  }) => {
    // 1. Log in as the owner
    const { saraId } = await seedTeaching();
    await createUser({
      phone: "+989120000000",
      role: "owner",
      displayName: "Reza",
      password: PASSWORD,
    });
    await login(page, "09120000000", PASSWORD);
    await expect(page).toHaveURL(/\/en\/owner$/);
    await expect(page.getByText("Mona English")).toBeVisible();

    // 2. Add Ali
    const add = t.Owner.add;
    await page.getByRole("textbox", { name: add.nameFa }).fill("علی");
    await page.getByRole("textbox", { name: add.nameEn }).fill("Ali");
    await page.getByRole("textbox", { name: add.brandName }).fill("Ali Talks");
    await page.getByRole("textbox", { name: add.phone }).fill("09350000009");
    await page.getByRole("textbox", { name: /Page address/ }).fill("ali");
    await page.getByRole("button", { name: add.submit }).click();
    await expect(page.getByText("Ali Talks")).toBeVisible();
    await expect(page.getByText(t.Owner.status.pending)).toBeVisible();
    const link = await page
      .getByRole("textbox", { name: t.Admin.learners.login.linkLabel })
      .inputValue();

    // 3. Ali sets his password and lands in his own, empty panel
    const ali = await (await browser.newContext()).newPage();
    await ali.goto(link.replace(/^https?:\/\/[^/]+/, "").replace("/fa/", "/en/"));
    await fillNewPassword(ali, "ali-pass-2026");
    await ali.getByRole("button", { name: t.Auth.submitActivate }).click();
    await expect(ali).toHaveURL(/\/en\/admin$/);
    await ali.goto("/en/admin/students");
    await expect(ali.getByRole("main").getByRole("link", { name: /^Sara/ })).toHaveCount(0);

    // 4. Ali adds Sara by her number, with his own note
    const form = t.Admin.learners.form;
    await ali.goto("/en/admin/students/new");
    await ali.getByRole("textbox", { name: form.fullNameFa }).fill("سارا");
    await ali.getByRole("textbox", { name: form.phone }).fill(STUDENT.phone.replace("+98", "0"));
    await ali.getByRole("textbox", { name: form.notes }).fill("Ali's note");
    await ali.getByRole("checkbox", { name: new RegExp(form.createLogin) }).uncheck();
    await ali.getByRole("button", { name: form.save }).click();
    await expect(ali).toHaveURL(new RegExp(`/en/admin/students/${saraId}$`));
    await expect(ali.getByText("Ali's note")).toBeVisible();

    // 5. Ali's page names Ali, never Mona
    await ali.goto("/en/ali");
    await expect(ali.getByRole("main")).toContainText("Ali");
    await expect(ali.getByRole("main")).not.toContainText("Mona");

    // 6. Mona sees Sara without Ali's note
    const mona = await (await browser.newContext()).newPage();
    await login(mona, ADMIN.local, PASSWORD);
    await mona.goto(`/en/admin/students/${saraId}`);
    await expect(mona.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(mona.getByText("Ali's note")).toHaveCount(0);
  });
});
