// spec: specs/security.plan.md
// seed: e2e/seed.spec.ts
import { expect, test } from "../fixtures";

test.describe("Security headers", () => {
  test("pages-send-security-headers", async ({ page }) => {
    // 1. Open /fa and /en/login
    for (const path of ["/fa", "/en/login"]) {
      const response = await page.goto(path);
      const headers = response!.headers();

      const csp = headers["content-security-policy"];
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("font-src 'self'");
      expect(csp).toContain("connect-src 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).not.toContain("unsafe-eval");

      expect(headers["permissions-policy"]).toContain("camera=(self)");
      expect(headers["permissions-policy"]).toContain("microphone=(self)");
      expect(headers["permissions-policy"]).toContain("geolocation=()");
      expect(headers["x-content-type-options"]).toBe("nosniff");
      expect(headers["x-frame-options"]).toBe("DENY");
      expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    }
  });
});
