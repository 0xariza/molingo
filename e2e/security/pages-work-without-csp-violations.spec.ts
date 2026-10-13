// spec: specs/security.plan.md
// seed: e2e/seed.spec.ts
import { expect, login, messages, PASSWORD, STUDENT, test } from "../fixtures";

declare global {
  interface Window {
    __cspViolations: string[];
  }
}

test.describe("Security headers", () => {
  test("pages-work-without-csp-violations", async ({ page, seedAccounts }) => {
    await seedAccounts();
    const violations: string[] = [];
    // Record violations on every page load; collect them before each navigation away.
    await page.addInitScript(() => {
      window.__cspViolations = [];
      document.addEventListener("securitypolicyviolation", (e) =>
        window.__cspViolations.push(`${e.violatedDirective} ${e.blockedURI}`),
      );
    });
    const collect = async () =>
      violations.push(...(await page.evaluate(() => window.__cspViolations)));

    // 1. Open the home page, switch language, open the login page, log in as Sara
    await page.goto("/fa");
    await page.getByRole("button", { name: messages.fa.Common.english }).first().click();
    await expect(page).toHaveURL(/\/en$/);
    await collect();
    await login(page, STUDENT.local, PASSWORD);
    await expect(page).toHaveURL(/\/en\/app$/);
    await collect();

    expect(violations).toEqual([]);
  });
});
