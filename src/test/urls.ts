const base = process.env.TEST_DATABASE_BASE ?? "postgres://molingo:molingo@127.0.0.1:5432";

/** Vitest integration tests. */
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? `${base}/molingo_test`;
/** Playwright end-to-end tests (the app server under test uses this database). */
export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? `${base}/molingo_e2e`;
