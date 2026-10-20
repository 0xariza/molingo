// spec: specs/classes.plan.md
// seed: e2e/seed.spec.ts
import { eq } from "drizzle-orm";
import { sessions } from "@/db/schema";
import { ADMIN, dayOfWeek, expect, login, messages, PASSWORD, test } from "../fixtures";

const t = messages.en.Admin.classes;

test.describe("Classes", () => {
  test("next-course-only-after-the-last-session", async ({
    page,
    db,
    seedTeaching,
    createClass,
  }) => {
    // 1. On a running class
    const { teacherId, saraId } = await seedTeaching();
    const cls = await createClass({
      teacherId,
      sessionCount: 2,
      startsOn: dayOfWeek(0, -2),
      slots: [{ weekday: 0, time: "10:30" }],
      studentIds: [saraId],
    });
    await login(page, ADMIN.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/admin$/);
    await page.goto(`/en/admin/classes/${cls.id}`);
    await expect(page.getByRole("link", { name: t.detail.next })).toHaveCount(0);
    await expect(page.getByText(/^Unlocks after the last session \(/)).toBeVisible();

    // 2. With every session held, follow "Continue with next course" and create it
    await db
      .update(sessions)
      .set({ status: "held", heldAt: new Date() })
      .where(eq(sessions.classId, cls.id));
    await page.reload();
    await page.getByRole("link", { name: t.detail.next }).click();
    await expect(page.getByRole("heading", { name: t.form.nextTitle })).toBeVisible();
    await expect(
      page.getByRole("group", { name: t.form.level }).getByRole("button", { name: /^B1/ }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("main").getByText("Sara", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: t.form.create }).click();
    await expect(page).not.toHaveURL(new RegExp(cls.id));
    await expect(page).toHaveURL(/\/en\/admin\/classes\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("link", { name: "Sara", exact: true })).toBeVisible();
  });
});
