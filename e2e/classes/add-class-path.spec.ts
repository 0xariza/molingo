// spec: specs/classes.plan.md
// seed: e2e/seed.spec.ts
import { ADMIN, dayOfWeek, expect, login, messages, PASSWORD, test } from "../fixtures";

const t = messages.en.Admin.paths;

test.describe("Classes", () => {
  test("add-class-path", async ({ page, seedTeaching, createClass, createSource }) => {
    // 1. With a class of 12 sessions and a complete A2 source, open the class page
    const { teacherId } = await seedTeaching();
    const cls = await createClass({
      teacherId,
      startsOn: dayOfWeek(0, 1),
      slots: [{ weekday: 0, time: "08:00" }],
    });
    await createSource({
      teacherId,
      stations: [
        { title: "Daily life", plannedSessions: 2 },
        { title: "Shopping", plannedSessions: 2 },
        { title: "My last weekend", plannedSessions: 2 },
      ],
    });
    await login(page, ADMIN.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/admin$/);
    await page.goto(`/en/admin/classes/${cls.id}`);
    await expect(page.getByText(t.page.cardEmpty)).toBeVisible();

    // 2. Press "Add a path" - the source is chosen with its three stations
    await page.getByRole("link", { name: t.page.add }).click();
    await expect(page.getByRole("heading", { name: t.page.addTitle })).toBeVisible();
    await expect(page.getByRole("radio", { name: /English File A2/ })).toBeChecked();
    await expect(page.getByText("Sessions 5–6")).toBeVisible();

    // 3. Untick "Shopping", give "My last weekend" one more session, press "Create path"
    await page.getByRole("checkbox", { name: "“Shopping” in this class" }).uncheck();
    await page.getByRole("button", { name: "One session more for “My last weekend”" }).click();
    await expect(page.getByText("Sessions 3–5")).toBeVisible();
    await page.getByRole("button", { name: t.page.create }).click();
    await expect(page.getByRole("main").getByRole("status")).toHaveText(t.page.saved);

    // 4. Back on the class page - the card lists the two stations with their sessions
    await page.goto(`/en/admin/classes/${cls.id}`);
    const card = page.getByRole("region", { name: t.page.card });
    await expect(card.getByText("Daily life")).toBeVisible();
    await expect(card.getByText("Sessions 1–2")).toBeVisible();
    await expect(card.getByText("My last weekend")).toBeVisible();
    await expect(card.getByText("Sessions 3–5")).toBeVisible();
    await expect(card.getByText("Shopping")).toHaveCount(0);
  });
});
