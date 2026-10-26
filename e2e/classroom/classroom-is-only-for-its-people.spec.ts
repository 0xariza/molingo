// spec: specs/classroom.plan.md
// seed: e2e/seed.spec.ts
import { expect, login, logout, messages, PASSWORD, STUDENT, test } from "../fixtures";

test.describe("Access rules", () => {
  test("classroom-is-only-for-its-people", async ({
    page,
    seedClassroom,
    createUser,
    createLearner,
  }) => {
    // 1. Sara can't use Mona's room route
    const { sessionId } = await seedClassroom(-5);
    await login(page, STUDENT.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/app$/);
    await page.goto(`/en/admin/classroom/${sessionId}`);
    await expect(page).toHaveURL(/\/en\/app$/);

    // 2. A learner with no place in the class gets the not-found page
    await logout(page);
    const other = await createUser({
      phone: "+989120000009",
      displayName: "Ali",
      password: PASSWORD,
    });
    await createLearner({ userId: other.id, fullNameFa: "علی", phone: "+989120000009" });
    await login(page, "09120000009", PASSWORD);
    await expect(page).toHaveURL(/\/en\/app$/);
    await page.goto(`/en/app/classroom/${sessionId}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(messages.en.NotFound.title);
  });
});
