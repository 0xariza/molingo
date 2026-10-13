// spec: specs/landing.plan.md
// seed: e2e/seed.spec.ts
import { leads, levelCheckSlots } from "@/db/schema";
import { expect, messages, test, tomorrowAt } from "../fixtures";

const t = messages.en.Landing.booking;

test.describe("Landing page", () => {
  test("booking-ignores-bots", async ({ page, db, createSlot }) => {
    // 1. Pick a time, fill the form and also the hidden honeypot field, submit
    await createSlot(tomorrowAt("18:00"));
    await page.goto("/en");
    await page.getByRole("button", { name: "18:00" }).click();
    await page.getByLabel(t.name).fill("Spam Bot");
    await page.getByLabel(t.phone).fill("09125551234");
    await page.locator("#book input[name=website]").fill("https://spam.example");
    await page.getByRole("button", { name: t.submit }).click();

    await expect(page.getByRole("status")).toContainText("Booked");
    expect(await db.select().from(leads)).toHaveLength(0);
    const [slot] = await db.select().from(levelCheckSlots);
    expect(slot.leadId).toBeNull();
  });
});
