// spec: specs/landing.plan.md
// seed: e2e/seed.spec.ts
import { expect, messages, test } from "../fixtures";

const t = messages.en.Landing;

test.describe("Landing page", () => {
  test("landing-shows-every-section", async ({ page }) => {
    // 1. Open /en
    await page.goto("/en");
    for (const heading of [
      t.roadmap.title1,
      t.ai.title1,
      t.week.title1,
      t.formats.title1,
      t.booking.title1,
      t.faq.title1,
    ]) {
      await expect(page.getByRole("heading", { level: 2, name: heading })).toBeVisible();
    }
    await expect(page.getByRole("heading", { name: t.formats.group.emptyTitle })).toBeVisible();
    const cta = page.getByRole("link", { name: messages.en.Common.freeSession }).first();
    await expect(cta).toHaveAttribute("href", "#book");
  });
});
