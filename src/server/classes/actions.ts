"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { requireTeacher } from "../auth/current";
import { fieldErrors, formLocale, text } from "../forms";
import type { ClashWith } from "./clash";
import {
  archiveClass,
  createClass,
  editClassSchema,
  endEnrollment,
  enroll,
  moveLearner,
  newClassSchema,
  updateClass,
} from "./classes";
import {
  addMakeup,
  attendanceSchema,
  cancelSchema,
  cancelSession,
  makeupSchema,
  markHeld,
  moveSchema,
  moveSession,
} from "./sessions";

/** Error keys map to messages under `Admin.classes.errors`. */
export type ClassFormState = {
  status: "idle" | "error" | "success";
  error?: string;
  fieldErrors?: Record<string, string>;
  /** With `clash`: the session it collides with. */
  clash?: ClashWith | null;
};

const bool = (form: FormData, key: string) =>
  text(form, key) === "on" || text(form, key) === "true";

export async function createClassAction(
  _: ClassFormState,
  form: FormData,
): Promise<ClassFormState> {
  const { teacherId } = await requireTeacher();
  const parsed = newClassSchema.safeParse({
    nameFa: text(form, "nameFa"),
    nameEn: text(form, "nameEn"),
    level: text(form, "level"),
    type: text(form, "type"),
    capacity: text(form, "capacity"),
    sessionCount: text(form, "sessionCount"),
    sessionMinutes: text(form, "sessionMinutes"),
    slots: text(form, "slots"),
    startsOn: text(form, "startsOn"),
    price: text(form, "price"),
    description: text(form, "description"),
    isPublic: bool(form, "isPublic"),
    studentIds: text(form, "studentIds"),
    fromClassId: text(form, "fromClassId") || undefined,
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error.issues) };

  const result = await createClass(parsed.data, teacherId);
  if (!result.ok)
    return {
      status: "error",
      error: result.error,
      clash: "clash" in result ? result.clash : undefined,
    };
  return redirect({ href: `/admin/classes/${result.id}`, locale: formLocale(form) });
}

export async function updateClassAction(
  _: ClassFormState,
  form: FormData,
): Promise<ClassFormState> {
  const { teacherId } = await requireTeacher();
  const id = z.uuid().safeParse(text(form, "id"));
  if (!id.success) return { status: "error", error: "not_found" };
  const parsed = editClassSchema.safeParse({
    nameFa: text(form, "nameFa"),
    nameEn: text(form, "nameEn"),
    level: text(form, "level"),
    capacity: text(form, "capacity"),
    price: text(form, "price"),
    description: text(form, "description"),
    isPublic: bool(form, "isPublic"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error.issues) };
  const result = await updateClass(teacherId, id.data, parsed.data);
  if (!result.ok) return { status: "error", error: result.error };
  return redirect({ href: `/admin/classes/${id.data}`, locale: formLocale(form) });
}

export async function archiveClassAction(form: FormData): Promise<void> {
  const { teacherId } = await requireTeacher();
  const id = z.uuid().safeParse(text(form, "id"));
  if (!id.success || !(await archiveClass(teacherId, id.data))) return refresh();
  redirect({ href: "/admin/classes", locale: formLocale(form) });
}

const placeInput = z.object({ classId: z.uuid(), studentId: z.uuid() });

export async function enrollAction(_: ClassFormState, form: FormData): Promise<ClassFormState> {
  const { teacherId } = await requireTeacher();
  const parsed = placeInput.safeParse({
    classId: text(form, "classId"),
    studentId: text(form, "studentId"),
  });
  if (!parsed.success) return { status: "error", error: "unavailable" };
  const result = await enroll(teacherId, parsed.data.classId, parsed.data.studentId);
  refresh();
  return result.ok ? { status: "success" } : { status: "error", error: result.error };
}

export async function endEnrollmentAction(form: FormData): Promise<void> {
  const { teacherId } = await requireTeacher();
  const parsed = placeInput.safeParse({
    classId: text(form, "classId"),
    studentId: text(form, "studentId"),
  });
  if (parsed.success) await endEnrollment(teacherId, parsed.data.classId, parsed.data.studentId);
  refresh();
}

export async function moveLearnerAction(
  _: ClassFormState,
  form: FormData,
): Promise<ClassFormState> {
  const { teacherId } = await requireTeacher();
  const parsed = z
    .object({ classId: z.uuid(), toClassId: z.uuid(), studentId: z.uuid() })
    .safeParse({
      classId: text(form, "classId"),
      toClassId: text(form, "toClassId"),
      studentId: text(form, "studentId"),
    });
  if (!parsed.success) return { status: "error", error: "pickClass" };
  const { classId, toClassId, studentId } = parsed.data;
  const result = await moveLearner(teacherId, classId, toClassId, studentId);
  refresh();
  return result.ok ? { status: "success" } : { status: "error", error: result.error };
}

export async function cancelSessionAction(
  _: ClassFormState,
  form: FormData,
): Promise<ClassFormState> {
  const { teacherId } = await requireTeacher();
  const parsed = cancelSchema.safeParse({
    sessionId: text(form, "sessionId"),
    reason: text(form, "reason"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error.issues) };
  const ok = await cancelSession(teacherId, parsed.data.sessionId, parsed.data.reason);
  refresh();
  return ok ? { status: "success" } : { status: "error", error: "not_cancellable" };
}

export async function markHeldAction(_: ClassFormState, form: FormData): Promise<ClassFormState> {
  const { teacherId } = await requireTeacher();
  let marks: unknown;
  try {
    marks = JSON.parse(text(form, "marks") || "{}");
  } catch {
    return { status: "error", error: "attendance" };
  }
  const parsed = attendanceSchema.safeParse({ sessionId: text(form, "sessionId"), marks });
  if (!parsed.success) return { status: "error", error: "attendance" };
  const result = await markHeld(teacherId, parsed.data.sessionId, parsed.data.marks);
  refresh();
  return result.ok ? { status: "success" } : { status: "error", error: result.error };
}

export async function addMakeupAction(_: ClassFormState, form: FormData): Promise<ClassFormState> {
  const { teacherId } = await requireTeacher();
  const parsed = makeupSchema.safeParse({
    classId: text(form, "classId"),
    date: text(form, "date"),
    time: text(form, "time"),
    minutes: text(form, "minutes"),
    replacesSessionId: text(form, "replacesSessionId") || undefined,
    studentIds: form.getAll("studentIds").map(String),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error.issues) };
  const result = await addMakeup(teacherId, parsed.data);
  if (!result.ok)
    return {
      status: "error",
      error: result.error,
      clash: "clash" in result ? result.clash : undefined,
    };
  return redirect({ href: `/admin/classes/${parsed.data.classId}`, locale: formLocale(form) });
}

/** Moves one upcoming session (from the week calendar). */
export async function moveSessionAction(
  _: ClassFormState,
  form: FormData,
): Promise<ClassFormState> {
  const { teacherId } = await requireTeacher();
  const parsed = moveSchema.safeParse({
    sessionId: text(form, "sessionId"),
    date: text(form, "date"),
    time: text(form, "time"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error.issues) };
  const result = await moveSession(teacherId, parsed.data);
  refresh();
  if (result.ok) return { status: "success" };
  return {
    status: "error",
    error: result.error,
    clash: "clash" in result ? result.clash : undefined,
  };
}
