// spec: specs/landing.plan.md
// seed: e2e/seed.spec.ts
import { leads, levelCheckSlots } from "@/db/schema";
import { expect, messages, test, tomorrowAt } from "../fixtures";

const t = messages.en.Landing.booking;

test.describe("Landing page", () => {
  test("booking-validates-fields", async ({ page, db, createSlot }) => {
    // 1. Pick the open time, enter a one-letter name and an invalid number, submit
    await createSlot(tomorrowAt("18:00"));
    await page.goto("/en");
    await page.getByRole("button", { name: "18:00" }).click();
    await page.getByLabel(t.name).fill("N");
    await page.getByLabel(t.phone).fill("12345");
    await page.getByRole("button", { name: t.submit }).click();

    await expect(page.getByText(t.errors.name)).toBeVisible();
    await expect(page.getByText(t.errors.phone)).toBeVisible();
    await expect(page.getByLabel(t.name)).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel(t.phone)).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel(t.name)).toHaveValue("N");
    await expect(page.getByLabel(t.phone)).toHaveValue("12345");
    expect(await db.select().from(leads)).toHaveLength(0);
    const [slot] = await db.select().from(levelCheckSlots);
    expect(slot.leadId).toBeNull();
  });
});
