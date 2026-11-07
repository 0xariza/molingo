import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { sessions } from "./classes";
import { homeworkTypeEnum, submissionStatusEnum } from "./enums";
import { stationSkills } from "./paths";
import { students, teachers, users } from "./identity";

/** An uploaded file; its bytes live on the uploads volume under this row's id. */
export const files = pgTable("files", {
  id: id(),
  ownerUserId: uuid()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  originalName: text().notNull(),
  mime: text().notNull(),
  sizeBytes: integer().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/**
 * Homework hangs off one held session; the class follows from it, and a session can have any
 * number of items. Each goes to the learners chosen at that moment (`assignmentRecipients`: all
 * active learners, or some of them), so learners who join later don't inherit it.
 */
export const assignments = pgTable(
  "assignments",
  {
    id: id(),
    teacherId: uuid()
      .notNull()
      .references(() => teachers.id, { onDelete: "restrict" }),
    sessionId: uuid()
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    type: homeworkTypeEnum().notNull().default("writing"),
    title: text().notNull(),
    body: text(),
    /** The station skill it practises, when the class has a path. */
    stationSkillId: uuid().references(() => stationSkills.id, { onDelete: "set null" }),
    /** Made by the app from a station check's "again"; one open per learner. */
    reinforcement: boolean().notNull().default(false),
    dueAt: timestamp({ withTimezone: true }),
    /** Null while it is a draft: learners only see published items. Set when the teacher sends. */
    publishedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [index().on(t.teacherId, t.createdAt), index().on(t.sessionId)],
);

export const assignmentRecipients = pgTable(
  "assignment_recipients",
  {
    assignmentId: uuid()
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    studentId: uuid()
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.assignmentId, t.studentId] }), index().on(t.studentId)],
);

export const assignmentFiles = pgTable(
  "assignment_files",
  {
    assignmentId: uuid()
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    fileId: uuid()
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.assignmentId, t.fileId] })],
);

/**
 * One learner's answer. A revision overwrites it and bumps `revision`; only the latest feedback
 * is kept. There is no score.
 */
export const submissions = pgTable(
  "submissions",
  {
    id: id(),
    assignmentId: uuid()
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    studentId: uuid()
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    body: text(),
    status: submissionStatusEnum().notNull().default("submitted"),
    feedback: text(),
    /** 1 for the first hand-in, +1 for each time the learner hands it in again. */
    revision: smallint().notNull().default(1),
    /** The latest hand-in; late means after the assignment's due time. */
    submittedAt: timestamp({ withTimezone: true }).notNull(),
    reviewedAt: timestamp({ withTimezone: true }),
  },
  (t) => [uniqueIndex().on(t.assignmentId, t.studentId), index().on(t.status)],
);

export const submissionFiles = pgTable(
  "submission_files",
  {
    submissionId: uuid()
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    fileId: uuid()
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.submissionId, t.fileId] })],
);
