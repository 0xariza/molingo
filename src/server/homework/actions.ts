"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { requireStudent, requireTeacher } from "../auth/current";
import { fieldErrors, formLocale, text } from "../forms";
import { uploadedFiles } from "../files/storage";
import { coveredSchema, saveCovered, sendAfterClass } from "./after-class";
import { assignmentSchema, deleteAssignment, saveAssignment } from "./assignments";
import { answerSchema, reviewSchema, reviewSubmission, submitAnswer } from "./submissions";

/** Error keys map to messages under `Admin.homework.errors` / `Student.homework.errors`. */
export type HomeworkFormState = {
  status: "idle" | "error" | "success";
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function assignHomeworkAction(
  _: HomeworkFormState,
  form: FormData,
): Promise<HomeworkFormState> {
  const teacher = await requireTeacher();
  const parsed = assignmentSchema.safeParse({
    id: text(form, "id") || undefined,
    sessionId: text(form, "sessionId"),
    type: text(form, "type"),
    title: text(form, "title"),
    titleFallback: text(form, "titleFallback"),
    body: text(form, "body"),
    dueDate: text(form, "dueDate"),
    dueTime: text(form, "dueTime"),
    studentIds: form.getAll("studentIds").map(String),
    stationSkillId: text(form, "stationSkillId"),
    keep: form.getAll("keep").map(String),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error.issues) };

  const result = await saveAssignment(
    { teacherId: teacher.teacherId, userId: teacher.id },
    parsed.data,
    uploadedFiles(form, "files"),
  );
  if (!result.ok) return { status: "error", error: result.error };
  refresh();
  return { status: "success" };
}

/** The after-class page's first part: what the session covered. */
export async function saveCoveredAction(
  _: HomeworkFormState,
  form: FormData,
): Promise<HomeworkFormState> {
  const { teacherId } = await requireTeacher();
  const parsed = coveredSchema.safeParse({
    sessionId: text(form, "sessionId"),
    topics: form.getAll("topics").map(String),
    summary: text(form, "summary"),
    privateNote: text(form, "privateNote"),
    skillIds: form.getAll("skillIds").map(String),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error.issues) };
  const saved = await saveCovered(teacherId, parsed.data);
  if (!saved) return { status: "error", error: "not_held" };
  refresh();
  return { status: "success" };
}

/** "Save and send": publishes the drafts and the covered log. Error keys: `Admin.afterClass.errors`. */
export async function sendAfterClassAction(
  _: HomeworkFormState,
  form: FormData,
): Promise<HomeworkFormState> {
  const { teacherId } = await requireTeacher();
  const id = z.uuid().safeParse(text(form, "sessionId"));
  if (!id.success) return { status: "error", error: "not_held" };
  const result = await sendAfterClass(teacherId, id.data);
  if (!result.ok) return { status: "error", error: result.error };
  refresh();
  return { status: "success" };
}

export async function deleteAssignmentAction(form: FormData): Promise<void> {
  const { teacherId } = await requireTeacher();
  const id = z.uuid().safeParse(text(form, "id"));
  if (id.success) await deleteAssignment(teacherId, id.data);
  refresh();
}

export async function reviewAction(
  _: HomeworkFormState,
  form: FormData,
): Promise<HomeworkFormState> {
  const { teacherId } = await requireTeacher();
  const parsed = reviewSchema.safeParse({
    id: text(form, "id"),
    decision: text(form, "decision"),
    feedback: text(form, "feedback"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error.issues) };

  const result = await reviewSubmission(teacherId, parsed.data);
  if (!result.ok) return { status: "error", error: result.error };
  const locale = formLocale(form);
  return redirect({
    href: result.nextId ? `/admin/homework/${result.nextId}` : "/admin/homework",
    locale,
  });
}

export async function submitAnswerAction(
  _: HomeworkFormState,
  form: FormData,
): Promise<HomeworkFormState> {
  const user = await requireStudent();
  const parsed = answerSchema.safeParse({
    assignmentId: text(form, "assignmentId"),
    body: text(form, "body"),
    keep: form.getAll("keep").map(String),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error.issues) };

  const result = await submitAnswer(user.id, parsed.data, uploadedFiles(form, "files"));
  if (!result.ok) return { status: "error", error: result.error };
  refresh();
  return { status: "success" };
}
