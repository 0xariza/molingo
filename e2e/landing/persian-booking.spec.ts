// spec: specs/landing.plan.md
// seed: e2e/seed.spec.ts
import { leads } from "@/db/schema";
import { expect, messages, test, tomorrowAt } from "../fixtures";

const t = messages.fa.Landing.booking;

test.describe("Landing page", () => {
  test("persian-booking", async ({ page, db, createSlot }) => {
    // 1. On /fa, pick "۱۸:۰۰", fill the form with Persian digits, submit
    await createSlot(tomorrowAt("18:00"));
    await page.goto("/fa");
    await page.getByRole("button", { name: "۱۸:۰۰" }).click();
    await page.getByLabel(t.name).fill("سارا احمدی");
    await page.getByLabel(t.phone).fill("۰۹۱۲ ۵۵۵ ۱۲۳۴");
    await page.getByRole("button", { name: t.submit }).click();

    await expect(page.getByRole("status")).toContainText("رزرو شد");
    const [lead] = await db.select().from(leads);
    expect(lead).toMatchObject({ name: "سارا احمدی", phone: "+989125551234", locale: "fa" });
  });
});
