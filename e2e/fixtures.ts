import { test as base, expect, type Page } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };
import fa from "../messages/fa.json" with { type: "json" };
import { connectTestDb, type TestDb } from "@/test/database";
import { createAuthToken, createUser, resetDb } from "@/test/factories";
import { E2E_DATABASE_URL } from "@/test/urls";

/** UI copy comes from the real message files, so tests don't break when wording changes. */
export const messages = { en, fa };

export const PASSWORD = "e2e-pass-2026";
export const ADMIN = { phone: "+989120000001", local: "09120000001", name: "Mona" };
export const STUDENT = { phone: "+989120000002", local: "09120000002", name: "Sara" };

type Fixtures = {
  db: TestDb;
  /** Creates Mona (admin) and Sara (student), both activated with PASSWORD. */
  seedAccounts: () => Promise<{ adminId: string; studentId: string }>;
  createUser: (overrides?: Parameters<typeof createUser>[1]) => ReturnType<typeof createUser>;
  createAuthToken: (
    userId: string,
    kind: "activation" | "reset",
    expiresAt?: Date,
  ) => Promise<string>;
};

export const test = base.extend<Fixtures, { workerDb: TestDb }>({
  workerDb: [
    async ({}, use) => {
      const { db, close } = connectTestDb(E2E_DATABASE_URL);
      await use(db);
      await close();
    },
    { scope: "worker" },
  ],
  // Fresh data (including rate-limit counters) for every test.
  db: async ({ workerDb }, use) => {
    await resetDb(workerDb);
    await use(workerDb);
  },
  createUser: async ({ db }, use) => {
    await use((overrides) => createUser(db, overrides));
  },
  createAuthToken: async ({ db }, use) => {
    await use((userId, kind, expiresAt) => createAuthToken(db, userId, kind, expiresAt));
  },
  seedAccounts: async ({ db }, use) => {
    await use(async () => {
      const admin = await createUser(db, {
        phone: ADMIN.phone,
        displayName: ADMIN.name,
        role: "admin",
        password: PASSWORD,
      });
      const student = await createUser(db, {
        phone: STUDENT.phone,
        displayName: STUDENT.name,
        role: "student",
        password: PASSWORD,
      });
      return { adminId: admin.id, studentId: student.id };
    });
  },
});

export { expect };

/** The form's error message. Scoped to <main>: Next's route announcer also has role="alert". */
export const formAlert = (page: Page) => page.getByRole("main").getByRole("alert");

/** Fills the English set-password form (activation and reset pages). */
export async function fillNewPassword(page: Page, password: string, confirm = password) {
  await page.getByRole("textbox", { name: messages.en.Auth.newPassword }).fill(password);
  await page.getByRole("textbox", { name: messages.en.Auth.confirmPassword }).fill(confirm);
}

/** Fills and submits the English login form at `path` (default /en/login). */
export async function login(page: Page, phone: string, password: string, path = "/en/login") {
  const t = messages.en.Auth;
  await page.goto(path);
  await page.getByLabel(t.phone).fill(phone);
  await page.getByLabel(t.password, { exact: true }).fill(password);
  await page.getByRole("button", { name: t.submitLogin }).click();
}
