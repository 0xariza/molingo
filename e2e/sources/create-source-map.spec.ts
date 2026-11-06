// spec: specs/sources.plan.md
// seed: e2e/seed.spec.ts
import { ADMIN, expect, login, messages, PASSWORD, test } from "../fixtures";

const t = messages.en.Admin.sources;
const fill = (s: string, values: Record<string, string>) =>
  Object.entries(values).reduce((out, [k, v]) => out.replace(`{${k}}`, v), s);

test.describe("Sources", () => {
  test("create-source-map", async ({ page, seedTeaching }) => {
    // 1. Log in as Mona, open the sources page, press "New source"
    await seedTeaching();
    await login(page, ADMIN.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/admin$/);
    await page.goto("/en/admin/sources");
    await page.getByRole("link", { name: t.add }).click();
    await expect(page.getByRole("heading", { name: t.form.newTitle })).toBeVisible();

    // 2. Name it, pick A2, bring the chapters down to 2
    await page.getByLabel(t.form.title).fill("Sample Book 2");
    await page.getByRole("button", { name: /^A2/ }).click();
    const chapters = page.getByRole("group", { name: t.form.chapters });
    for (let i = 0; i < 6; i++) await chapters.getByRole("button", { name: t.form.less }).click();
    await expect(
      page.getByText(fill(t.form.preview, { stations: "2", sessions: "4" })),
    ).toBeVisible();

    // 3. Create the stations
    await page.getByRole("button", { name: t.form.create }).click();
    await expect(page.getByRole("heading", { name: "Sample Book 2" })).toBeVisible();
    await expect(page.getByText(fill(t.map.done, { done: "0", total: "2" }))).toBeVisible();

    // 4. Fill the first station and save it
    await page.getByLabel(t.station.title).fill("I can talk about my past");
    for (const [i, skill] of [
      "Tells a memory in order",
      "Says what they did",
      "Asks about the past",
    ].entries())
      await page.getByLabel(fill(t.station.skillLabel, { n: String(i + 1) })).fill(skill);
    await page.getByRole("button", { name: t.station.save }).click();
    await expect(page.getByRole("status")).toHaveText(t.station.saved);
    await expect(page.getByText(fill(t.map.done, { done: "1", total: "2" }))).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: t.map.stations }).getByRole("link").first(),
    ).toContainText(t.map.complete);

    // 5. The sources page shows the map's state
    await page.goto("/en/admin/sources");
    await expect(page.getByRole("link", { name: /Sample Book 2/ })).toContainText(
      fill(t.state.partial, { done: "1", total: "2" }),
    );
  });
});
