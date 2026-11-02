// spec: specs/landing.plan.md
// seed: e2e/seed.spec.ts
import { expect, messages, test, tomorrowAt } from "../fixtures";

const t = messages.en.Landing.booking;

test.describe("Landing page", () => {
  test("no-open-times", async ({ page, createSlot }) => {
    // 1. With no open times (one past, one booked), open /en/mona
    await createSlot(new Date(Date.now() - 60 * 60 * 1000));
    await createSlot(tomorrowAt("18:00"), { name: "Someone", phone: "+989121112222" });
    await page.goto("/en/mona");
    await expect(page.getByText(t.noSlots.replace("{teacher}", "Mona"))).toBeVisible();
    await expect(page.getByRole("button", { name: t.submit })).toHaveCount(0);
  });
});
