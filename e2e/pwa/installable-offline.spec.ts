// spec: specs/pwa.plan.md
// seed: e2e/seed.spec.ts
import { expect, test } from "../fixtures";

test.describe("Installable web app", () => {
  test("manifest-and-offline-page", async ({ page, request }) => {
    // 1. The page links a manifest that names the app and its icons
    await page.goto("/en");
    const href = await page.locator('link[rel="manifest"]').getAttribute("href");
    const manifest = await (await request.get(href!)).json();
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons.length).toBeGreaterThanOrEqual(3);

    // 2. The service worker takes control of the page
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

    // 3. Offline, a page navigation shows the offline page
    await page.context().setOffline(true);
    await page.goto("/en/login").catch(() => {});
    await expect(page.getByRole("heading", { name: /اینترنت وصل نیست/ })).toBeVisible();
    await page.context().setOffline(false);
  });
});
