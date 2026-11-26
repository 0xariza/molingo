// spec: specs/seo.plan.md
// seed: e2e/seed.spec.ts
import { expect, test } from "../fixtures";

test.describe("Search engines", () => {
  test("public-pages-for-search", async ({ page, request, createSlot }) => {
    await createSlot(new Date(Date.now() + 24 * 3600_000)); // makes Mona and her page

    // 1. robots.txt hides the signed-in areas and points to the sitemap
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /*/admin");
    expect(robots).toMatch(/Sitemap: .*\/sitemap\.xml/);

    // 2. The sitemap lists the teacher's page in both languages
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("/fa/mona");
    expect(sitemap).toContain("/en/mona");

    // 3. The teacher page has a canonical, hreflang, share tags and structured data
    await page.goto("/en/mona");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/en\/mona$/);
    await expect(page.locator('link[rel="alternate"][hreflang="fa"]')).toHaveAttribute(
      "href",
      /\/fa\/mona$/,
    );
    await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveCount(1);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /og-en\.png$/,
    );
    const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(JSON.parse(ld!)["@type"]).toBe("EducationalOrganization");

    // 4. An unknown address is not for search
    await page.goto("/en/nobody-here");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });
});
