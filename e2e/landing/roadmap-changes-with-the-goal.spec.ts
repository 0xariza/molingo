// spec: specs/landing.plan.md
// seed: e2e/seed.spec.ts
import { expect, messages, test } from "../fixtures";

const t = messages.en.Landing.roadmap;

test.describe("Landing page", () => {
  test("roadmap-changes-with-the-goal", async ({ page }) => {
    // 1. Open /en
    await page.goto("/en");
    // The hero shows a sample roadmap too, so look inside the roadmap section.
    const roadmap = page.locator("#roadmap");
    const goals = roadmap.getByRole("group", { name: t.try });
    await expect(goals.getByRole("button", { name: t.goals.work.label })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(roadmap.getByText(t.goals.work.s1)).toBeVisible();

    // 2. Press "Moving abroad"
    await goals.getByRole("button", { name: t.goals.move.label }).click();
    await expect(goals.getByRole("button", { name: t.goals.move.label })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(roadmap.getByText(t.goals.move.s1)).toBeVisible();
    await expect(roadmap.getByText(t.goals.work.s1)).toBeHidden();
  });
});
