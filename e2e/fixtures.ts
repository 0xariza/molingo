import { test as base, expect, type Page } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };
import fa from "../messages/fa.json" with { type: "json" };
import { connectTestDb, type TestDb } from "@/test/database";
import { formatDate, formatDayParts, fromTehranTime, tehranDateKey } from "@/lib/format";
import { leads } from "@/db/schema";
import { addDays, weekStartOf, type Weekday } from "@/lib/schedule";
import {
  createAuthToken,
  createClass,
  createLearner,
  createLevelCheckSlot,
  createTeacher,
  createUser,
  resetDb,
} from "@/test/factories";
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
  /** Opens a free-session time Mona offers (optionally already booked). */
  createSlot: (
    startsAt: Date,
    bookedBy?: { name: string; phone: string },
  ) => ReturnType<typeof createLevelCheckSlot>;
  /** Creates Mona with her teacher record and Sara as an active learner with a login. */
  seedTeaching: () => Promise<{ adminId: string; teacherId: string; saraId: string }>;
  createLearner: (
    overrides?: Parameters<typeof createLearner>[1],
  ) => ReturnType<typeof createLearner>;
  createClass: (input: Parameters<typeof createClass>[1]) => ReturnType<typeof createClass>;
  /**
   * The schedule plan's week, all in next week: "Morning A2" on Saturday and Monday 10:30–12:00
   * with Sara, an open level-check time Monday 18:00, Tuesday 18:00 booked online by Nika
   * Rahimi, and Mahsa (added by Mona) waiting for a time.
   */
  seedSchedule: () => ReturnType<typeof createClass>;
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
  createSlot: async ({ db }, use) => {
    await use((startsAt, bookedBy) => createLevelCheckSlot(db, startsAt, bookedBy));
  },
  createLearner: async ({ db }, use) => {
    await use((overrides) => createLearner(db, overrides));
  },
  createClass: async ({ db }, use) => {
    await use((input) => createClass(db, input));
  },
  seedTeaching: async ({ db, seedAccounts }, use) => {
    await use(async () => {
      const { adminId, studentId } = await seedAccounts();
      const teacher = await createTeacher(db, adminId);
      const sara = await createLearner(db, {
        userId: studentId,
        fullNameFa: "سارا احمدی",
        fullNameEn: STUDENT.name,
        phone: STUDENT.phone,
      });
      return { adminId, teacherId: teacher.id, saraId: sara.id };
    });
  },
  seedSchedule: async ({ db, seedTeaching }, use) => {
    await use(async () => {
      const { teacherId, saraId } = await seedTeaching();
      const cls = await createClass(db, {
        teacherId,
        startsOn: dayOfWeek(0, 1),
        slots: [
          { weekday: 0, time: "10:30" },
          { weekday: 2, time: "10:30" },
        ],
        studentIds: [saraId],
      });
      await createLevelCheckSlot(db, nextWeekAt(2, "18:00"));
      await createLevelCheckSlot(db, nextWeekAt(3, "18:00"), {
        name: "Nika Rahimi",
        phone: "+989125551234",
      });
      // Added by Mona earlier; her time was cancelled, so she's waiting again.
      await db
        .insert(leads)
        .values({ name: "Mahsa", phone: "+989121112233", locale: "fa", source: "manual" });
      return cls;
    });
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

/** Tomorrow (Tehran) at a Tehran wall-clock time such as "18:00". */
export const tomorrowAt = (time: string) =>
  fromTehranTime(tehranDateKey(new Date(Date.now() + 24 * 60 * 60 * 1000)), time);

/** A Tehran date ("YYYY-MM-DD") in the Sat–Fri week `weeks` from now; weekday 0 = Saturday. */
export const dayOfWeek = (weekday: Weekday, weeks = 0) =>
  addDays(weekStartOf(tehranDateKey(new Date()), weeks), weekday);

/** A Tehran wall-clock time on a weekday of next week (always fully in the future). */
export const nextWeekAt = (weekday: Weekday, time: string) =>
  fromTehranTime(dayOfWeek(weekday, 1), time);

/** A day chip in the week calendar and the move form, e.g. "Mon 26". */
export function dayChip(dateKey: string) {
  const p = formatDayParts(fromTehranTime(dateKey, "12:00"), "en");
  return `${p.weekday} ${p.day}`;
}

/** A date as the English UI writes it, e.g. "Sat 24 Oct". */
export const dateLabel = (dateKey: string) =>
  formatDate(fromTehranTime(dateKey, "12:00"), "en", { year: false });

/** On the phone week view (one day at a time), shows that day. */
export const showDay = (page: Page, dateKey: string) =>
  page
    .getByRole("group", { name: messages.en.Admin.schedule.days })
    .getByRole("button", { name: dayChip(dateKey) })
    .click();

/** Picks a date in the English date picker, paging forward a month when needed. */
export async function pickDate(page: Page, dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  const day = date.getUTCDate();
  const ordinal = [1, 21, 31].includes(day)
    ? "st"
    : [2, 22].includes(day)
      ? "nd"
      : [3, 23].includes(day)
        ? "rd"
        : "th";
  const part = (o: Intl.DateTimeFormatOptions) =>
    date.toLocaleDateString("en-US", { ...o, timeZone: "UTC" });
  const name = `${part({ weekday: "long" })}, ${part({ month: "long" })} ${day}${ordinal}, ${date.getUTCFullYear()}`;
  const button = page.getByRole("button", { name: new RegExp(`${name}$`) });
  if (!(await button.isVisible()))
    await page.getByRole("button", { name: "Go to the Next Month" }).click();
  await button.click();
}

/** The form's error message. Scoped to <main>: Next's route announcer also has role="alert". */
export const formAlert = (page: Page) => page.getByRole("main").getByRole("alert");

/** Fills the English set-password form (activation and reset pages). */
export async function fillNewPassword(page: Page, password: string, confirm = password) {
  await page.getByRole("textbox", { name: messages.en.Auth.newPassword }).fill(password);
  await page.getByRole("textbox", { name: messages.en.Auth.confirmPassword }).fill(confirm);
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: messages.en.Common.logout }).click();
  await expect(page).toHaveURL(/\/en\/login$/);
}

/** Fills and submits the English login form at `path` (default /en/login). */
export async function login(page: Page, phone: string, password: string, path = "/en/login") {
  const t = messages.en.Auth;
  await page.goto(path);
  await page.getByLabel(t.phone).fill(phone);
  await page.getByLabel(t.password, { exact: true }).fill(password);
  await page.getByRole("button", { name: t.submitLogin }).click();
}
