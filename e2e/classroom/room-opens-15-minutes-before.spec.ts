// spec: specs/classroom.plan.md
// seed: e2e/seed.spec.ts
import { formatTime } from "@/lib/format";
import { expect, login, messages, PASSWORD, STUDENT, test } from "../fixtures";

const t = messages.en.Classroom;

test.describe("Getting into the room", () => {
  test("room-opens-15-minutes-before", async ({ page, seedClassroom }) => {
    // 1. A make-up in two hours: no "Join class" yet
    const { sessionId, startsAt } = await seedClassroom(120);
    await login(page, STUDENT.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/app$/);
    await expect(page.getByRole("link", { name: t.join })).toHaveCount(0);

    // 2. Opening the room directly says when it opens
    const opens = formatTime(new Date(startsAt.getTime() - 15 * 60_000), "en");
    await page.goto(`/en/app/classroom/${sessionId}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(t.closedTitle);
    await expect(page.getByText(t.errors.tooEarly.replace("{time}", opens))).toBeVisible();
  });
});
