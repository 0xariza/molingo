import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { sessions, students, teacherLearners } from "@/db/schema";
import { fromTehranTime } from "@/lib/format";
import { createTeacher, createUser, resetDb } from "@/test/factories";
import { createClass, enroll, newClassSchema } from "@/server/classes/classes";
import {
  assessmentReview,
  assessmentSchema,
  autoScore,
  getAssessment,
  learnerAssessments,
  learnerResult,
  markAnswer,
  publishResult,
  saveAssessment,
  setAssessmentOpen,
  startAssessment,
  submitAssessment,
} from "../assessments";

const now = fromTehranTime("2026-10-14", "12:00");
let teacher: { teacherId: string };

beforeEach(async () => {
  await resetDb(db);
  const user = await createUser(db, { phone: "+989120000001", role: "teacher" });
  teacher = { teacherId: (await createTeacher(db, user.id)).id };
});

/** A two-session class (no path) with Sara enrolled; the exam belongs on the last session. */
async function setup() {
  const made = await createClass(
    newClassSchema.parse({
      nameFa: "صبح A2",
      nameEn: "",
      level: "A2",
      type: "private",
      capacity: "1",
      sessionCount: "2",
      sessionMinutes: "90",
      slots: JSON.stringify([{ weekday: 0, time: "08:00" }]),
      startsOn: "2026-10-24",
      price: "650000",
      description: "",
      isPublic: false,
      studentIds: "[]",
    }),
    teacher.teacherId,
    now,
  );
  if (!made.ok) throw new Error(made.error);
  const user = await createUser(db, { phone: "+989130000001" });
  const [sara] = await db
    .insert(students)
    .values({ userId: user.id, fullNameFa: "سارا", phone: user.phone })
    .returning({ id: students.id });
  await db
    .insert(teacherLearners)
    .values({ teacherId: teacher.teacherId, studentId: sara.id, status: "active" });
  await enroll(teacher.teacherId, made.id, sara.id);
  const [first, last] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.classId, made.id))
    .orderBy(asc(sessions.startsAt));
  return { first: first.id, last: last.id, userId: user.id, saraId: sara.id };
}

const exam = (sessionId: string) =>
  assessmentSchema.parse({
    sessionId,
    minutes: 30,
    questions: [
      {
        section: "grammar",
        kind: "mc",
        prompt: "She ___ come.",
        options: ["didn't", "doesn't"],
        correctIndex: 0,
        points: 2,
      },
      {
        section: "grammar",
        kind: "short",
        prompt: "I ___ (go) there.",
        accepted: ["went"],
        points: 1,
      },
      { section: "writing", kind: "essay", prompt: "Write about your weekend.", points: 5 },
    ],
  });

describe("auto marking", () => {
  const q = { correctIndex: 1, acceptedAnswers: ["Went"], points: 3 };
  it("marks choices and short answers, leaves essays for the teacher", () => {
    expect(autoScore({ ...q, kind: "mc" }, { choice: 1, text: null })).toBe(3);
    expect(autoScore({ ...q, kind: "mc" }, { choice: 0, text: null })).toBe(0);
    expect(autoScore({ ...q, kind: "short" }, { choice: null, text: " went " })).toBe(3);
    expect(autoScore({ ...q, kind: "short" }, { choice: null, text: "" })).toBe(0);
    expect(autoScore({ ...q, kind: "essay" }, { choice: null, text: "long" })).toBeNull();
  });
});

describe("assessment", () => {
  it("is allowed only on the last session", async () => {
    const { first, last } = await setup();
    expect(await getAssessment(teacher.teacherId, first)).toBeNull();
    expect(await saveAssessment(teacher.teacherId, exam(first))).toEqual({
      ok: false,
      error: "not_eligible",
    });
    expect((await getAssessment(teacher.teacherId, last))?.kind).toBe("final");
  });

  it("runs from build to a published result", async () => {
    const { last, userId, saraId } = await setup();
    expect(await saveAssessment(teacher.teacherId, exam(last))).toEqual({ ok: true });
    expect(await learnerAssessments(userId)).toEqual([]); // not opened yet
    await setAssessmentOpen(teacher.teacherId, last, true);
    const [open] = await learnerAssessments(userId);

    const started = (await startAssessment(userId, open.id))!;
    expect(JSON.stringify(started.questions)).not.toContain("correctIndex");
    const [mc, short, essay] = started.questions;
    const answers = [
      { questionId: mc.id, choice: 0, text: null },
      { questionId: short.id, choice: null, text: "Went" },
      { questionId: essay.id, choice: null, text: "I stayed home." },
    ];
    // Too late: past the minutes plus the grace.
    expect(
      await submitAssessment(userId, open.id, answers, new Date(Date.now() + 40 * 60_000)),
    ).toEqual({ ok: false, error: "closed" });
    expect(await submitAssessment(userId, open.id, answers)).toEqual({ ok: true });
    expect(await submitAssessment(userId, open.id, answers)).toEqual({
      ok: false,
      error: "submitted",
    });
    expect(await saveAssessment(teacher.teacherId, exam(last))).toEqual({
      ok: false,
      error: "started",
    });

    const review = (await assessmentReview(teacher.teacherId, last))!;
    expect(review.max).toBe(8);
    expect(review.learners[0]).toMatchObject({ score: 3, unmarked: 1 });
    expect(
      await publishResult(teacher.teacherId, {
        assessmentId: review.assessmentId,
        studentId: saraId,
        feedback: null,
      }),
    ).toEqual({ ok: false, error: "unmarked" });
    expect(
      await markAnswer(teacher.teacherId, { questionId: essay.id, studentId: saraId, score: 6 }),
    ).toEqual({ ok: false, error: "score" });
    expect(
      await markAnswer(teacher.teacherId, { questionId: mc.id, studentId: saraId, score: 1 }),
    ).toEqual({ ok: false, error: "score" });
    expect(
      await markAnswer(teacher.teacherId, { questionId: essay.id, studentId: saraId, score: 4 }),
    ).toEqual({ ok: true });

    expect(await learnerResult(userId, open.id)).toBeNull(); // not sent yet
    expect(
      await publishResult(teacher.teacherId, {
        assessmentId: review.assessmentId,
        studentId: saraId,
        feedback: "Good",
      }),
    ).toEqual({ ok: true });
    expect(await learnerResult(userId, open.id)).toMatchObject({
      score: 7,
      max: 8,
      feedback: "Good",
    });
  });
});
