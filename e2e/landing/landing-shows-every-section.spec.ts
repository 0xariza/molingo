// spec: specs/landing.plan.md
// seed: e2e/seed.spec.ts
import { expect, messages, test, tomorrowAt } from "../fixtures";

const t = messages.en.Landing;

test.describe("Landing page", () => {
  test("landing-shows-every-section", async ({ page, createSlot }) => {
    // 1. With an open time tomorrow (so the booking shows its row of days), open /en
    await createSlot(tomorrowAt("18:00"));
    await page.goto("/en");
    for (const heading of [
      t.guides.title1.replace("{teacher}", "Mona"),
      t.ai.title1,
      t.formats.title1,
      t.booking.title1,
      t.faq.title1,
    ]) {
      await expect(page.getByRole("heading", { level: 2, name: heading })).toBeVisible();
    }
    await expect(page.getByRole("heading", { name: t.formats.group.emptyTitle })).toBeVisible();
    const cta = page.getByRole("link", { name: messages.en.Common.freeSession }).first();
    await expect(cta).toHaveAttribute("href", "#book");
    // Nothing is wider than the phone: no sideways scroll.
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBe(0);
  });
});
