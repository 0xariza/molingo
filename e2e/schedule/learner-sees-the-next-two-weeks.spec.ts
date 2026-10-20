// spec: specs/schedule.plan.md
// seed: e2e/seed.spec.ts
import type { Page } from "@playwright/test";
import {
  dateLabel,
  dayOfWeek,
  expect,
  login,
  messages,
  PASSWORD,
  STUDENT,
  test,
} from "../fixtures";

const t = messages.en.Student;

async function nextSession(page: Page) {
  await login(page, STUDENT.local, PASSWORD);
  await expect(page).toHaveURL(/\/en\/app$/);
  return page.getByRole("region").filter({ hasText: t.schedule.next });
}

test.describe("Learner schedule", () => {
  test.use({ timezoneId: "Europe/London" });

  test("learner-sees-the-next-two-weeks", async ({ page, browser, seedSchedule }) => {
    // 1. Log in as Sara
    await seedSchedule();
    const next = await nextSession(page);
    await expect(next.getByRole("heading")).toHaveText("Morning A2 · A2");
    await expect(next).toContainText("(Tehran time)");
    await expect(page.getByRole("link", { name: t.home.seeAll })).toBeVisible();

    // 2. Open "My schedule"
    await page.getByRole("link", { name: t.nav.schedule }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(t.schedule.title);
    await expect(page.getByRole("region", { name: dateLabel(dayOfWeek(0, 1)) })).toContainText(
      "Session 1 of 12",
    );
    await expect(page.getByRole("region", { name: dateLabel(dayOfWeek(2, 1)) })).toContainText(
      "Session 2 of 12",
    );

    // 3. On a device in London the device time shows; on one in Tehran it doesn't
    await expect(page.getByText(/^Your device time: /).first()).toBeVisible();
    const tehran = await browser.newContext({
      ...test.info().project.use,
      timezoneId: "Asia/Tehran",
    });
    const tehranPage = await tehran.newPage();
    const tehranNext = await nextSession(tehranPage);
    await expect(tehranNext).toContainText("(Tehran time)");
    await expect(tehranPage.getByText(/^Your device time: /)).toHaveCount(0);
    await tehran.close();
  });
});
