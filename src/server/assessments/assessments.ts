import { and, asc, eq, gt, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  assessmentAnswers,
  assessmentQuestions,
  assessmentResults,
  assessments,
  enrollments,
  sessions,
  students,
} from "@/db/schema";

const GRACE_MS = 60_000;

/** Error keys map to `Admin.assessment.errors` / `Student.assessment.errors`. */
export type AssessmentError =
  "not_found" | "not_eligible" | "started" | "closed" | "submitted" | "unmarked" | "score";

type Done<T = object> = ({ ok: true } & T) | { ok: false; error: AssessmentError };

const line = (max: number) => z.string().trim().min(1, "invalid").max(max, "invalid");
const base = {
  section: z.enum(["reading", "grammar", "writing"]),
  prompt: line(500),
  points: z.coerce.number().int().min(1, "invalid").max(20, "invalid"),
};
const questionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...base,
      kind: z.literal("mc"),
      options: z.array(line(200)).min(2, "invalid").max(5, "invalid"),
      correctIndex: z.coerce.number().int().min(0),
    })
    .refine((q) => q.correctIndex < q.options.length, "invalid"),
  z.object({
    ...base,
    kind: z.literal("short"),
    accepted: z.array(line(200)).min(1, "invalid").max(10, "invalid"),
  }),
  z.object({ ...base, kind: z.literal("essay") }),
]);
export const assessmentSchema = z.object({
  sessionId: z.uuid(),
  minutes: z.coerce.number().int().min(5, "invalid").max(180, "invalid"),
  questions: z.array(questionSchema).min(1, "invalid").max(40, "invalid"),
});
export type AssessmentInput = z.output<typeof assessmentSchema>;

/** Multiple choice and short answers are marked here; an essay waits for the teacher (null). */
export function autoScore(
  q: {
    kind: "mc" | "short" | "essay";
    correctIndex: number | null;
    acceptedAnswers: string[] | null;
    points: number;
  },
  a: { choice: number | null; text: string | null },
): number | null {
  if (q.kind === "essay") return null;
  if (q.kind === "mc") return a.choice !== null && a.choice === q.correctIndex ? q.points : 0;
  const given = (a.text ?? "").trim().toLowerCase();
  return given && q.acceptedAnswers?.some((x) => x.trim().toLowerCase() === given) ? q.points : 0;
}

/** `stage` on a station's last session, `final` on the class's last one, otherwise not allowed. */
async function kindOf(teacherId: string, sessionId: string) {
  const [s] = await db
    .select({
      classId: sessions.classId,
      startsAt: sessions.startsAt,
      pathStationId: sessions.pathStationId,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.id, sessionId),
        eq(sessions.teacherId, teacherId),
        ne(sessions.status, "cancelled"),
      ),
    );
  if (!s) return null;
  const later = (where: ReturnType<typeof eq>) =>
    db
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(where, ne(sessions.status, "cancelled"), gt(sessions.startsAt, s.startsAt)))
      .limit(1);
  if (s.pathStationId && !(await later(eq(sessions.pathStationId, s.pathStationId))).length)
    return { kind: "stage" as const, classId: s.classId };
  if (!(await later(eq(sessions.classId, s.classId))).length)
    return { kind: "final" as const, classId: s.classId };
  return null;
}

export async function getAssessment(teacherId: string, sessionId: string) {
  const eligible = await kindOf(teacherId, sessionId);
  if (!eligible) return null;
  const [a] = await db.select().from(assessments).where(eq(assessments.sessionId, sessionId));
  const questions = a
    ? await db
        .select()
        .from(assessmentQuestions)
        .where(eq(assessmentQuestions.assessmentId, a.id))
        .orderBy(asc(assessmentQuestions.position))
    : [];
  const [started] = a
    ? await db
        .select({ n: sql<number>`count(*)::int` })
        .from(assessmentResults)
        .where(eq(assessmentResults.assessmentId, a.id))
    : [{ n: 0 }];
  return { kind: eligible.kind, assessment: a ?? null, questions, started: started.n > 0 };
}

/** Creates or replaces the exam of a session; locked once any learner has started. */
export async function saveAssessment(teacherId: string, input: AssessmentInput): Promise<Done> {
  const eligible = await kindOf(teacherId, input.sessionId);
  if (!eligible) return { ok: false, error: "not_eligible" };
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: assessments.id })
      .from(assessments)
      .where(eq(assessments.sessionId, input.sessionId));
    if (existing) {
      const [r] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(assessmentResults)
        .where(eq(assessmentResults.assessmentId, existing.id));
      if (r.n > 0) return { ok: false, error: "started" } as const;
    }
    const [row] = existing
      ? await tx
          .update(assessments)
          .set({ minutes: input.minutes, kind: eligible.kind })
          .where(eq(assessments.id, existing.id))
          .returning({ id: assessments.id })
      : await tx
          .insert(assessments)
          .values({
            teacherId,
            sessionId: input.sessionId,
            kind: eligible.kind,
            minutes: input.minutes,
          })
          .returning({ id: assessments.id });
    await tx.delete(assessmentQuestions).where(eq(assessmentQuestions.assessmentId, row.id));
    await tx.insert(assessmentQuestions).values(
      input.questions.map((q, position) => ({
        assessmentId: row.id,
        position,
        section: q.section,
        kind: q.kind,
        prompt: q.prompt,
        points: q.points,
        options: q.kind === "mc" ? q.options : null,
        correctIndex: q.kind === "mc" ? q.correctIndex : null,
        acceptedAnswers: q.kind === "short" ? q.accepted : null,
      })),
    );
    return { ok: true } as const;
  });
}

/** Opens (or closes) the exam for the class. */
export async function setAssessmentOpen(teacherId: string, sessionId: string, open: boolean) {
  const [done] = await db
    .update(assessments)
    .set({ openedAt: open ? new Date() : null })
    .where(and(eq(assessments.sessionId, sessionId), eq(assessments.teacherId, teacherId)))
    .returning({ id: assessments.id });
  return !!done;
}

/** Everyone's answers for the teacher to mark, with scores so far. */
export async function assessmentReview(teacherId: string, sessionId: string) {
  const [a] = await db
    .select()
    .from(assessments)
    .where(and(eq(assessments.sessionId, sessionId), eq(assessments.teacherId, teacherId)));
  if (!a) return null;
  const [questions, results, answers] = await Promise.all([
    db
      .select()
      .from(assessmentQuestions)
      .where(eq(assessmentQuestions.assessmentId, a.id))
      .orderBy(asc(assessmentQuestions.position)),
    db
      .select({
        studentId: assessmentResults.studentId,
        fullNameFa: students.fullNameFa,
        submittedAt: assessmentResults.submittedAt,
        feedback: assessmentResults.feedback,
        publishedAt: assessmentResults.publishedAt,
      })
      .from(assessmentResults)
      .innerJoin(students, eq(students.id, assessmentResults.studentId))
      .where(eq(assessmentResults.assessmentId, a.id))
      .orderBy(asc(students.fullNameFa)),
    db
      .select({
        questionId: assessmentAnswers.questionId,
        studentId: assessmentAnswers.studentId,
        choice: assessmentAnswers.choice,
        text: assessmentAnswers.text,
        score: assessmentAnswers.score,
      })
      .from(assessmentAnswers)
      .innerJoin(assessmentQuestions, eq(assessmentQuestions.id, assessmentAnswers.questionId))
      .where(eq(assessmentQuestions.assessmentId, a.id)),
  ]);
  const max = questions.reduce((n, q) => n + q.points, 0);
  return {
    assessmentId: a.id,
    max,
    questions,
    learners: results.map((r) => {
      const mine = answers.filter((x) => x.studentId === r.studentId);
      return {
        ...r,
        answers: mine,
        score: mine.reduce((n, x) => n + (x.score ?? 0), 0),
        unmarked: mine.filter((x) => x.score === null).length,
      };
    }),
  };
}

/** Scores one essay answer (0..points). */
export async function markAnswer(
  teacherId: string,
  input: { questionId: string; studentId: string; score: number },
): Promise<Done> {
  const [q] = await db
    .select({ points: assessmentQuestions.points, kind: assessmentQuestions.kind })
    .from(assessmentQuestions)
    .innerJoin(assessments, eq(assessments.id, assessmentQuestions.assessmentId))
    .where(and(eq(assessmentQuestions.id, input.questionId), eq(assessments.teacherId, teacherId)));
  if (!q) return { ok: false, error: "not_found" };
  if (
    q.kind !== "essay" ||
    !Number.isInteger(input.score) ||
    input.score < 0 ||
    input.score > q.points
  )
    return { ok: false, error: "score" };
  const [done] = await db
    .update(assessmentAnswers)
    .set({ score: input.score })
    .where(
      and(
        eq(assessmentAnswers.questionId, input.questionId),
        eq(assessmentAnswers.studentId, input.studentId),
      ),
    )
    .returning({ id: assessmentAnswers.questionId });
  return done ? { ok: true } : { ok: false, error: "not_found" };
}

/** Sends the result to the learner; only once every answer of theirs is marked. */
export async function publishResult(
  teacherId: string,
  input: { assessmentId: string; studentId: string; feedback: string | null },
): Promise<Done> {
  const [a] = await db
    .select({ id: assessments.id })
    .from(assessments)
    .where(and(eq(assessments.id, input.assessmentId), eq(assessments.teacherId, teacherId)));
  if (!a) return { ok: false, error: "not_found" };
  const [open] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(assessmentAnswers)
    .innerJoin(assessmentQuestions, eq(assessmentQuestions.id, assessmentAnswers.questionId))
    .where(
      and(
        eq(assessmentQuestions.assessmentId, a.id),
        eq(assessmentAnswers.studentId, input.studentId),
        sql`${assessmentAnswers.score} is null`,
      ),
    );
  if (open.n > 0) return { ok: false, error: "unmarked" };
  const [done] = await db
    .update(assessmentResults)
    .set({ feedback: input.feedback, publishedAt: new Date() })
    .where(
      and(
        eq(assessmentResults.assessmentId, a.id),
        eq(assessmentResults.studentId, input.studentId),
        isNotNull(assessmentResults.submittedAt),
      ),
    )
    .returning({ id: assessmentResults.studentId });
  return done ? { ok: true } : { ok: false, error: "not_found" };
}

// ───────────────────────── Learner ─────────────────────────

const studentOf = async (userId: string) =>
  (await db.select({ id: students.id }).from(students).where(eq(students.userId, userId)))[0]?.id ??
  null;

/** Exams the teacher opened for the learner's classes, with where the learner stands. */
export async function learnerAssessments(userId: string) {
  const studentId = await studentOf(userId);
  if (!studentId) return [];
  const rows = await db
    .select({
      id: assessments.id,
      kind: assessments.kind,
      minutes: assessments.minutes,
      submittedAt: assessmentResults.submittedAt,
      publishedAt: assessmentResults.publishedAt,
    })
    .from(assessments)
    .innerJoin(sessions, eq(sessions.id, assessments.sessionId))
    .innerJoin(
      enrollments,
      and(
        eq(enrollments.classId, sessions.classId),
        eq(enrollments.studentId, studentId),
        eq(enrollments.status, "active"),
      ),
    )
    .leftJoin(
      assessmentResults,
      and(
        eq(assessmentResults.assessmentId, assessments.id),
        eq(assessmentResults.studentId, studentId),
      ),
    )
    .where(isNotNull(assessments.openedAt))
    .orderBy(asc(sessions.startsAt));
  return rows;
}

async function openFor(studentId: string, assessmentId: string) {
  const [a] = await db
    .select({ id: assessments.id, minutes: assessments.minutes, kind: assessments.kind })
    .from(assessments)
    .innerJoin(sessions, eq(sessions.id, assessments.sessionId))
    .innerJoin(
      enrollments,
      and(
        eq(enrollments.classId, sessions.classId),
        eq(enrollments.studentId, studentId),
        eq(enrollments.status, "active"),
      ),
    )
    .where(and(eq(assessments.id, assessmentId), isNotNull(assessments.openedAt)));
  return a ?? null;
}

/** Starts the learner's attempt (once) and returns the questions without the answer key. */
export async function startAssessment(userId: string, assessmentId: string) {
  const studentId = await studentOf(userId);
  const a = studentId ? await openFor(studentId, assessmentId) : null;
  if (!studentId || !a) return null;
  await db.insert(assessmentResults).values({ assessmentId, studentId }).onConflictDoNothing();
  const [mine] = await db
    .select()
    .from(assessmentResults)
    .where(
      and(
        eq(assessmentResults.assessmentId, assessmentId),
        eq(assessmentResults.studentId, studentId),
      ),
    );
  const questions = await db
    .select({
      id: assessmentQuestions.id,
      section: assessmentQuestions.section,
      kind: assessmentQuestions.kind,
      prompt: assessmentQuestions.prompt,
      options: assessmentQuestions.options,
      points: assessmentQuestions.points,
    })
    .from(assessmentQuestions)
    .where(eq(assessmentQuestions.assessmentId, assessmentId))
    .orderBy(asc(assessmentQuestions.position));
  const given = await db
    .select({
      questionId: assessmentAnswers.questionId,
      choice: assessmentAnswers.choice,
      text: assessmentAnswers.text,
    })
    .from(assessmentAnswers)
    .where(
      and(
        eq(assessmentAnswers.studentId, studentId),
        inArray(
          assessmentAnswers.questionId,
          questions.map((q) => q.id),
        ),
      ),
    );
  return { ...a, startedAt: mine.startedAt, submitted: !!mine.submittedAt, questions, given };
}

export const answersSchema = z.array(
  z.object({
    questionId: z.uuid(),
    choice: z.number().int().min(0).max(4).nullable(),
    text: z.string().max(4000).nullable(),
  }),
);

/** Submits the attempt: every question gets an answer row, auto-marked where it can be. */
export async function submitAssessment(
  userId: string,
  assessmentId: string,
  answers: z.output<typeof answersSchema>,
  now = new Date(),
): Promise<Done> {
  const studentId = await studentOf(userId);
  const a = studentId ? await openFor(studentId, assessmentId) : null;
  if (!studentId || !a) return { ok: false, error: "not_found" };
  const [mine] = await db
    .select()
    .from(assessmentResults)
    .where(
      and(
        eq(assessmentResults.assessmentId, assessmentId),
        eq(assessmentResults.studentId, studentId),
      ),
    );
  if (!mine) return { ok: false, error: "not_found" };
  if (mine.submittedAt) return { ok: false, error: "submitted" };
  if (now.getTime() > mine.startedAt.getTime() + a.minutes * 60_000 + GRACE_MS)
    return { ok: false, error: "closed" };
  const questions = await db
    .select()
    .from(assessmentQuestions)
    .where(eq(assessmentQuestions.assessmentId, assessmentId));
  await db.transaction(async (tx) => {
    await tx
      .insert(assessmentAnswers)
      .values(
        questions.map((q) => {
          const given = answers.find((x) => x.questionId === q.id);
          const choice = q.kind === "mc" ? (given?.choice ?? null) : null;
          const text = q.kind === "mc" ? null : given?.text?.trim() || null;
          return {
            questionId: q.id,
            studentId,
            choice,
            text,
            score: autoScore(q, { choice, text }),
          };
        }),
      )
      .onConflictDoNothing();
    await tx
      .update(assessmentResults)
      .set({ submittedAt: now })
      .where(
        and(
          eq(assessmentResults.assessmentId, assessmentId),
          eq(assessmentResults.studentId, studentId),
        ),
      );
  });
  return { ok: true };
}

/** The published result: total and per-section scores plus the teacher's feedback. */
export async function learnerResult(userId: string, assessmentId: string) {
  const studentId = await studentOf(userId);
  if (!studentId) return null;
  const [r] = await db
    .select()
    .from(assessmentResults)
    .where(
      and(
        eq(assessmentResults.assessmentId, assessmentId),
        eq(assessmentResults.studentId, studentId),
        isNotNull(assessmentResults.publishedAt),
      ),
    );
  if (!r) return null;
  const rows = await db
    .select({
      section: assessmentQuestions.section,
      points: assessmentQuestions.points,
      score: assessmentAnswers.score,
    })
    .from(assessmentQuestions)
    .leftJoin(
      assessmentAnswers,
      and(
        eq(assessmentAnswers.questionId, assessmentQuestions.id),
        eq(assessmentAnswers.studentId, studentId),
      ),
    )
    .where(eq(assessmentQuestions.assessmentId, assessmentId));
  const sections = new Map<string, { score: number; max: number }>();
  for (const x of rows) {
    const s = sections.get(x.section) ?? { score: 0, max: 0 };
    sections.set(x.section, { score: s.score + (x.score ?? 0), max: s.max + x.points });
  }
  const sum = (k: "score" | "max") => [...sections.values()].reduce((n, s) => n + s[k], 0);
  return {
    feedback: r.feedback,
    score: sum("score"),
    max: sum("max"),
    sections: [...sections].map(([section, v]) => ({ section, ...v })),
  };
}
