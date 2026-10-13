// spec: specs/landing.plan.md
// seed: e2e/seed.spec.ts
import { leads, levelCheckSlots } from "@/db/schema";
import { expect, messages, test, tomorrowAt } from "../fixtures";

const t = messages.en.Landing.booking;

test.describe("Landing page", () => {
  test("booking-saves-lead-and-takes-slot", async ({ page, db, createSlot }) => {
    // 1. With one open time tomorrow at 18:00, open /en, press the "18:00" time
    await createSlot(tomorrowAt("18:00"));
    await page.goto("/en");
    await page.getByRole("button", { name: "18:00" }).click();
    await expect(page.getByText(/· 20 minutes with Mona/)).toContainText("18:00");

    // 2. Fill name, mobile number and level, press "Confirm my session"
    await page.getByLabel(t.name).fill("Nika Rahimi");
    await page.getByLabel(t.phone).fill("0912 555 1234");
    await page.getByLabel(t.level).selectOption("intermediate");
    await page.getByRole("button", { name: t.submit }).click();
    await expect(page.getByRole("status")).toContainText("Booked");

    const rows = await db.select().from(leads);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: "Nika Rahimi",
      phone: "+989125551234",
      levelGuess: "intermediate",
      locale: "en",
      status: "scheduled",
    });
    const [slot] = await db.select().from(levelCheckSlots);
    expect(slot.leadId).toBe(rows[0].id);
  });
});
