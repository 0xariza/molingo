import { pgEnum } from "drizzle-orm/pg-core";

export const localeEnum = pgEnum("locale", ["fa", "en"]);
export const userRoleEnum = pgEnum("user_role", ["admin", "teacher", "student"]);
export const authTokenKindEnum = pgEnum("auth_token_kind", ["activation", "reset"]);
export const studentStatusEnum = pgEnum("student_status", ["lead", "active", "paused", "left"]);
export const leadStatusEnum = pgEnum("lead_status", [
  "new",
  "contacted",
  "scheduled",
  "converted",
  "lost",
]);
export const levelGuessEnum = pgEnum("level_guess", [
  "unsure",
  "beginner",
  "intermediate",
  "advanced",
]);
