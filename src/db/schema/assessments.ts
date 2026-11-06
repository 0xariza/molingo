import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgEnum,
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
import { students, teachers } from "./identity";

export const assessmentKindEnum = pgEnum("assessment_kind", ["stage", "final"]);
export const assessmentSectionEnum = pgEnum("assessment_section", [
  "reading",
  "grammar",
  "writing",
]);
export const questionKindEnum = pgEnum("question_kind", ["mc", "short", "essay"]);

/** A station check or final assessment, built like an exam on one session. At most one per session. */
export const assessments = pgTable(
  "assessments",
  {
    id: id(),
    teacherId: uuid()
      .notNull()
      .references(() => teachers.id, { onDelete: "restrict" }),
    sessionId: uuid()
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    kind: assessmentKindEnum().notNull(),
    minutes: smallint().notNull(),
    /** Learners can start only once the teacher opens it. */
    openedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex().on(t.sessionId),
    check("assessments_minutes_check", sql`${t.minutes} between 5 and 180`),
  ],
);

export const assessmentQuestions = pgTable(
  "assessment_questions",
  {
    id: id(),
    assessmentId: uuid()
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    position: smallint().notNull(),
    section: assessmentSectionEnum().notNull(),
    kind: questionKindEnum().notNull(),
    prompt: text().notNull(),
    /** Multiple choice only. */
    options: text().array(),
    correctIndex: smallint(),
    /** Short answer only, compared case-insensitively. */
    acceptedAnswers: text().array(),
    points: smallint().notNull(),
  },
  (t) => [
    index().on(t.assessmentId, t.position),
    check("assessment_questions_points_check", sql`${t.points} between 1 and 20`),
  ],
);

/** One learner's attempt: started when they open it, submitted once; marking is then the teacher's. */
export const assessmentResults = pgTable(
  "assessment_results",
  {
    assessmentId: uuid()
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    studentId: uuid()
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    submittedAt: timestamp({ withTimezone: true }),
    feedback: text(),
    /** Set when the teacher sends the result; the learner sees the score only then. */
    publishedAt: timestamp({ withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.assessmentId, t.studentId] })],
);

/** `score` is set at submission for multiple choice and short answers, by the teacher for essays. */
export const assessmentAnswers = pgTable(
  "assessment_answers",
  {
    questionId: uuid()
      .notNull()
      .references(() => assessmentQuestions.id, { onDelete: "cascade" }),
    studentId: uuid()
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    choice: smallint(),
    text: text(),
    score: smallint(),
  },
  (t) => [primaryKey({ columns: [t.questionId, t.studentId] })],
);
