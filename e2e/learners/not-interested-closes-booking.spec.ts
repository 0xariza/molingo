// spec: specs/learners.plan.md
// seed: e2e/seed.spec.ts
import { leads } from "@/db/schema";
import { ADMIN, expect, login, messages, PASSWORD, test, tomorrowAt } from "../fixtures";

const t = messages.en.Admin.learners.followUps;

test.describe("Learners", () => {
  test("not-interested-closes-booking", async ({ page, db, seedAccounts, createSlot }) => {
    // 1. With a booking by "Nika Rahimi", open the learners and press "Nika Rahimi is not interested"
    await seedAccounts();
    await createSlot(tomorrowAt("18:00"), { name: "Nika Rahimi", phone: "+989125551234" });
    await login(page, ADMIN.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/admin$/);
    await page.goto("/en/admin/students");
    await page
      .getByRole("button", { name: t.notInterestedLabel.replace("{name}", "Nika Rahimi") })
      .click();
    await expect(page.getByRole("heading", { name: new RegExp(t.title) })).toHaveCount(0);
    const [lead] = await db.select().from(leads);
    expect(lead.status).toBe("lost");
  });
});
