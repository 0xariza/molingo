// spec: specs/classes.plan.md
// seed: e2e/seed.spec.ts
import {
  ADMIN,
  dateLabel,
  dayOfWeek,
  expect,
  login,
  messages,
  PASSWORD,
  pickDate,
  test,
} from "../fixtures";

const t = messages.en.Admin.classes;

test.describe("Classes", () => {
  test("create-group-class", async ({ page, seedTeaching }) => {
    // 1. Log in as Mona, open the classes, press "New class"
    await seedTeaching();
    await login(page, ADMIN.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/admin$/);
    await page.goto("/en/admin/classes");
    await page.getByRole("link", { name: t.add }).click();
    await expect(page.getByRole("heading", { name: t.form.newTitle })).toBeVisible();

    // 2. Fill the Persian and English names, press the "A2" level
    await page.getByRole("textbox", { name: t.form.nameFa }).fill("صبح A2");
    await page.getByRole("textbox", { name: t.form.nameEn }).fill("Morning A2");
    const a2 = page.getByRole("group", { name: t.form.level }).getByRole("button", { name: /^A2/ });
    await a2.click();
    await expect(a2).toHaveAttribute("aria-pressed", "true");

    // 3. Add two days, set the second to Monday, type 08:00 in both
    await page.getByRole("button", { name: t.form.addSlot }).click();
    await page.getByRole("button", { name: t.form.addSlot }).click();
    await page.getByRole("combobox", { name: /Day of weekly session 2/ }).click();
    await page.getByRole("option", { name: "Monday" }).click();
    await page.getByRole("textbox", { name: "Start time on Saturday" }).fill("08:00");
    await page.getByRole("textbox", { name: "Start time on Monday" }).fill("08:00");

    // 4. Open "Start date", pick next Saturday
    const saturday = dayOfWeek(0, 1);
    await page.getByRole("button", { name: new RegExp(`^${t.form.startsOn}`) }).click();
    await expect(page.getByRole("button", { name: /Sunday, / }).first()).toBeDisabled();
    await expect(page.getByRole("button", { name: /Tuesday, / }).first()).toBeDisabled();
    await pickDate(page, saturday);
    // 12 sessions on Saturdays and Mondays: the last is the sixth Monday.
    await expect(
      page.getByText(`${dateLabel(dayOfWeek(2, 6))} ${dayOfWeek(2, 6).slice(0, 4)}`),
    ).toBeVisible();

    // 5. Type the tuition, press "Create class"
    const price = page.getByRole("textbox", { name: t.form.priceGroup });
    await price.fill("6500000");
    await expect(price).toHaveValue("6,500,000");
    await page.getByRole("button", { name: t.form.create }).click();
    await expect(page).toHaveURL(/\/en\/admin\/classes\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Morning A2");
    await expect(page.getByText("0 of 12 held")).toBeVisible();
  });
});
