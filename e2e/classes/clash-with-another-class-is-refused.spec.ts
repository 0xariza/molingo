// spec: specs/classes.plan.md
// seed: e2e/seed.spec.ts
import {
  ADMIN,
  dayOfWeek,
  expect,
  formAlert,
  login,
  messages,
  PASSWORD,
  pickDate,
  test,
} from "../fixtures";

const t = messages.en.Admin.classes;

test.describe("Classes", () => {
  test("clash-with-another-class-is-refused", async ({ page, seedTeaching, createClass }) => {
    // 1. With a class on Saturdays 08:00–09:30, create another on Saturdays at 09:00 from the same day
    const { teacherId } = await seedTeaching();
    const saturday = dayOfWeek(0, 1);
    await createClass({ teacherId, startsOn: saturday, slots: [{ weekday: 0, time: "08:00" }] });
    await login(page, ADMIN.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/admin$/);
    await page.goto("/en/admin/classes/new");
    await page.getByRole("textbox", { name: t.form.nameFa }).fill("کلاس دوم");
    await page.getByRole("button", { name: t.form.addSlot }).click();
    await page.getByRole("textbox", { name: "Start time on Saturday" }).fill("09:00");
    await page.getByRole("button", { name: new RegExp(`^${t.form.startsOn}`) }).click();
    await pickDate(page, saturday);
    await page.getByRole("textbox", { name: t.form.priceGroup }).fill("6500000");
    await page.getByRole("button", { name: t.form.create }).click();
    await expect(formAlert(page)).toContainText("Clashes with Morning A2 on");
    await expect(page).toHaveURL(/\/en\/admin\/classes\/new$/);
  });
});
