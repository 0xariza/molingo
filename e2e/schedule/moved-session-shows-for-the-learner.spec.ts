// spec: specs/schedule.plan.md
// seed: e2e/seed.spec.ts
import { eq } from "drizzle-orm";
import { sessions } from "@/db/schema";
import {
  dateLabel,
  dayOfWeek,
  expect,
  login,
  messages,
  nextWeekAt,
  PASSWORD,
  STUDENT,
  test,
} from "../fixtures";

const t = messages.en.Student.schedule;

test.describe("Learner schedule", () => {
  test("moved-session-shows-for-the-learner", async ({ page, db, seedSchedule }) => {
    // 1. With Monday's session moved to Wednesday 16:00
    const cls = await seedSchedule();
    const monday = cls.sessions[1];
    const startsAt = nextWeekAt(4, "16:00");
    await db
      .update(sessions)
      .set({
        startsAt,
        endsAt: new Date(startsAt.getTime() + 90 * 60_000),
        movedFrom: monday.startsAt,
      })
      .where(eq(sessions.id, monday.id));

    // 2. As Sara, open "My schedule"
    await login(page, STUDENT.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/app$/);
    await page.goto("/en/app/schedule");
    const wednesday = page.getByRole("region", { name: dateLabel(dayOfWeek(4, 1)) });
    await expect(wednesday).toContainText("16:00");
    await expect(wednesday).toContainText(t.moved);
    await expect(wednesday).toContainText(`Moved from ${dateLabel(dayOfWeek(2, 1))} 10:30`);
    await expect(page.getByRole("region", { name: dateLabel(dayOfWeek(2, 1)) })).toHaveCount(0);
  });
});
