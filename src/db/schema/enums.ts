import { pgEnum } from "drizzle-orm/pg-core";

export const localeEnum = pgEnum("locale", ["fa", "en"]);
/** `owner` runs the platform (adds teachers); a `teacher` runs their own classes and learners. */
export const userRoleEnum = pgEnum("user_role", ["owner", "teacher", "student"]);
export const authTokenKindEnum = pgEnum("auth_token_kind", ["activation", "reset"]);
export const studentStatusEnum = pgEnum("student_status", ["lead", "active", "paused", "left"]);
export const leadStatusEnum = pgEnum("lead_status", [
  "new",
  "contacted",
  "scheduled",
  "converted",
  "lost",
]);
/** How a level check was booked: by the visitor on the landing page, or by Mona. */
export const leadSourceEnum = pgEnum("lead_source", ["online", "manual"]);
export const levelGuessEnum = pgEnum("level_guess", [
  "unsure",
  "beginner",
  "intermediate",
  "advanced",
]);
export const cefrLevelEnum = pgEnum("cefr_level", ["A1", "A2", "B1", "B2", "C1", "C2"]);
export const classTypeEnum = pgEnum("class_type", ["private", "group"]);
export const sessionKindEnum = pgEnum("session_kind", ["class", "makeup"]);
export const sessionStatusEnum = pgEnum("session_status", ["scheduled", "held", "cancelled"]);
export const enrollmentStatusEnum = pgEnum("enrollment_status", ["active", "ended"]);
export const attendanceStatusEnum = pgEnum("attendance_status", ["present", "absent", "excused"]);
