// spec: specs/classroom.plan.md
// seed: e2e/seed.spec.ts
import { ADMIN, expect, login, messages, PASSWORD, test } from "../fixtures";

const t = messages.en.Classroom;

test.describe("Getting into the room", () => {
  test("mona-enters-from-the-class-page", async ({ page, seedClassroom }) => {
    // 1. A make-up that started 10 minutes ago: the class page's banner offers the room
    const { sessionId, classId } = await seedClassroom(-10);
    await login(page, ADMIN.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/admin$/);
    await page.goto(`/en/admin/classes/${classId}`);

    // 2. "Enter the room" opens the pre-join screen
    await page.getByRole("link", { name: t.enter }).click();
    await expect(page).toHaveURL(new RegExp(`/en/admin/classroom/${sessionId}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(t.prejoin.heading);
  });
});
