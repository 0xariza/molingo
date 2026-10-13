// Starting point for planning and generating tests with playwright-cli (see specs/*.plan.md):
// a fresh database with Mona and Sara, on the English login page.
import { test } from "./fixtures";

test("seed", async ({ page, seedAccounts }) => {
  await seedAccounts();
  await page.goto("/en/login");
});
