// spec: specs/classroom.plan.md
// seed: e2e/seed.spec.ts
import { expect, login, messages, PASSWORD, STUDENT, test } from "../fixtures";

const t = messages.en.Classroom;

test.describe("Getting into the room", () => {
  test("learner-joins-from-the-dashboard", async ({ page, seedClassroom }) => {
    // 1. A make-up that started 10 minutes ago; Sara's dashboard offers "Join class"
    const { sessionId } = await seedClassroom(-10);
    await login(page, STUDENT.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/app$/);
    await expect(page.getByText(messages.en.Student.schedule.live)).toBeVisible();

    // 2. Follow it: the pre-join screen for that session
    await page.getByRole("link", { name: t.join }).click();
    await expect(page).toHaveURL(new RegExp(`/en/app/classroom/${sessionId}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(t.prejoin.heading);
    await expect(page.getByText("Morning A2 · A2")).toBeVisible();
    await expect(page.getByRole("button", { name: t.prejoin.join })).toBeVisible();
    await expect(page.getByRole("button", { name: t.prejoin.joinAudio })).toBeVisible();

    // 3. "Back" returns to the dashboard
    await page.getByRole("link", { name: t.prejoin.back }).click();
    await expect(page).toHaveURL(/\/en\/app$/);
  });
});
