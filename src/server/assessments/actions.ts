"use server";

import { refresh } from "next/cache";
import { requireStudent, requireTeacher } from "../auth/current";
import { text } from "../forms";

type AnswerInput = { questionId: string; choice: number | null; text: string | null };
import {
  answersSchema,
  assessmentSchema,
  markAnswer,
  publishResult,
  saveAssessment,
  setAssessmentOpen,
  submitAssessment,
} from "./assessments";

/** Error keys map to `Admin.assessment.errors` / `Student.assessment.errors`. */
export type AssessmentFormState = { status: "idle" | "error" | "success"; error?: string };

const json = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

/** The builder posts the whole exam as one JSON field. */
export async function saveAssessmentAction(
  _: AssessmentFormState,
  form: FormData,
): Promise<AssessmentFormState> {
  const { teacherId } = await requireTeacher();
  const parsed = assessmentSchema.safeParse(json(text(form, "data")));
  if (!parsed.success) return { status: "error", error: "invalid" };
  const saved = await saveAssessment(teacherId, parsed.data);
  if (!saved.ok) return { status: "error", error: saved.error };
  refresh();
  return { status: "success" };
}

export async function openAssessmentAction(form: FormData): Promise<void> {
  const { teacherId } = await requireTeacher();
  await setAssessmentOpen(teacherId, text(form, "sessionId"), text(form, "open") === "1");
  refresh();
}

export async function markAnswerAction(form: FormData): Promise<void> {
  const { teacherId } = await requireTeacher();
  await markAnswer(teacherId, {
    questionId: text(form, "questionId"),
    studentId: text(form, "studentId"),
    score: Number(text(form, "score")),
  });
  refresh();
}

export async function publishResultAction(form: FormData): Promise<void> {
  const { teacherId } = await requireTeacher();
  await publishResult(teacherId, {
    assessmentId: text(form, "assessmentId"),
    studentId: text(form, "studentId"),
    feedback: text(form, "feedback").trim().slice(0, 2000) || null,
  });
  refresh();
}

/** Answers arrive as `c:<questionId>` (choice index) or `t:<questionId>` (text). */
export async function submitAssessmentAction(
  _: AssessmentFormState,
  form: FormData,
): Promise<AssessmentFormState> {
  const user = await requireStudent();
  const answers = answersSchema.safeParse(
    [...form.entries()].flatMap(([key, value]): AnswerInput[] => {
      const [tag, questionId] = key.split(":");
      if (tag === "c") return [{ questionId, choice: Number(value), text: null }];
      if (tag === "t") return [{ questionId, choice: null, text: String(value) }];
      return [];
    }),
  );
  if (!answers.success) return { status: "error", error: "invalid" };
  const done = await submitAssessment(user.id, text(form, "assessmentId"), answers.data);
  if (!done.ok) return { status: "error", error: done.error };
  refresh();
  return { status: "success" };
}
