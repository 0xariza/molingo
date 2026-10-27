// spec: specs/landing.plan.md
// seed: e2e/seed.spec.ts
import { eq } from "drizzle-orm";
import { leads, levelCheckSlots } from "@/db/schema";
import { expect, messages, test, tomorrowAt } from "../fixtures";

const t = messages.en.Landing.booking;

test.describe("Landing page", () => {
  test("taken-time-is-refused", async ({ page, db, createSlot }) => {
    // 1. With two open times, pick 18:00; meanwhile someone else books it
    const six = await createSlot(tomorrowAt("18:00"));
    await createSlot(tomorrowAt("19:00"));
    await page.goto("/en");
    await page.getByRole("button", { name: "18:00" }).click();
    const [other] = await db
      .insert(leads)
      .values({
        teacherId: six.teacherId,
        name: "Someone else",
        phone: "+989121112222",
        locale: "en",
        status: "scheduled",
      })
      .returning();
    await db
      .update(levelCheckSlots)
      .set({ leadId: other.id })
      .where(eq(levelCheckSlots.id, six.id));

    // 2. Fill the form and submit
    await page.getByLabel(t.name).fill("Nika Rahimi");
    await page.getByLabel(t.phone).fill("09125551234");
    await page.getByRole("button", { name: t.submit }).click();

    await expect(page.getByRole("main").getByRole("alert")).toHaveText(t.errors.slot_taken);
    await expect(page.getByRole("button", { name: "18:00" })).toBeHidden();
    await expect(page.getByRole("button", { name: "19:00" })).toBeVisible();
    expect((await db.select().from(leads)).map((l) => l.name)).toEqual(["Someone else"]);
  });
});
