import { defineConfig, devices } from "@playwright/test";
import { E2E_DATABASE_URL } from "./src/test/urls";

const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  // Every test resets the shared e2e database, so tests run one at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  // Mobile-first: most students use phones (Android Chrome and iOS Safari).
  projects: [
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 15"] } },
  ],
  // Tests run against a real production build, pointed at the dedicated e2e database.
  // (The web server starts before any global setup, so it also prepares the database.)
  webServer: {
    command: "tsx scripts/prepare-e2e-db.ts && pnpm build && pnpm start",
    url: `http://localhost:${PORT}/api/health`,
    // Never reuse a running server: it may be serving an older build.
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      APP_URL: `http://localhost:${PORT}`,
      PORT: String(PORT),
      HOSTNAME: "localhost",
    },
  },
});
