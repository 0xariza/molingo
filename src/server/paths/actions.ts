"use server";

import { refresh } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { requireTeacher } from "../auth/current";
import { fieldErrors, formLocale, text } from "../forms";
import { pathField, saveClassPath } from "./class-paths";
import { checkSchema, saveStationCheck } from "./station-check";
import {
  addStationAfter,
  createSource,
  deleteStation,
  moveStation,
  newSourceSchema,
  saveStation,
  stationSchema,
} from "./sources";

/** Error keys map to messages under `Admin.sources.errors`. */
export type SourceFormState = {
  status: "idle" | "error" | "success";
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function createSourceAction(
  _: SourceFormState,
  form: FormData,
): Promise<SourceFormState> {
  const { teacherId } = await requireTeacher();
  const parsed = newSourceSchema.safeParse({
    title: text(form, "title"),
    level: text(form, "level"),
    chapters: text(form, "chapters"),
    plannedSessions: text(form, "plannedSessions"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error.issues) };
  const id = await createSource(parsed.data, teacherId);
  return redirect({ href: `/admin/sources/${id}`, locale: formLocale(form) });
}

export async function saveStationAction(
  _: SourceFormState,
  form: FormData,
): Promise<SourceFormState> {
  const { teacherId } = await requireTeacher();
  const parsed = stationSchema.safeParse({
    title: text(form, "title"),
    sourceUnit: text(form, "sourceUnit"),
    plannedSessions: text(form, "plannedSessions"),
    skills: form.getAll("skill").map(String),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error.issues) };
  if (!(await saveStation(teacherId, text(form, "stationId"), parsed.data)))
    return { status: "error", error: "notFound" };
  refresh();
  return { status: "success" };
}

const sourcePage = (form: FormData, stationId: string) =>
  redirect({
    href: `/admin/sources/${text(form, "sourceId")}?station=${stationId}`,
    locale: formLocale(form),
  });

export async function addStationAction(form: FormData) {
  const { teacherId } = await requireTeacher();
  const id = await addStationAfter(teacherId, text(form, "stationId"));
  if (id) sourcePage(form, id);
}

export async function moveStationAction(form: FormData) {
  const { teacherId } = await requireTeacher();
  const dir = text(form, "dir") === "up" ? -1 : 1;
  await moveStation(teacherId, text(form, "stationId"), dir);
  refresh();
}

export async function deleteStationAction(form: FormData) {
  const { teacherId } = await requireTeacher();
  if ((await deleteStation(teacherId, text(form, "stationId"))) === "ok")
    sourcePage(form, text(form, "nextId"));
}

/** Adds or edits an existing class's path. Error keys map to `Admin.paths.errors`. */
export async function savePathAction(_: SourceFormState, form: FormData): Promise<SourceFormState> {
  const { teacherId } = await requireTeacher();
  const parsed = pathField.safeParse(text(form, "path"));
  if (!parsed.success) return { status: "error", error: parsed.error.issues[0]?.message ?? "path" };
  const error = await saveClassPath(teacherId, text(form, "classId"), parsed.data);
  if (error) return { status: "error", error };
  refresh();
  return { status: "success" };
}

/** Error keys map to messages under `Admin.afterClass.check.errors`. */
export type CheckFormState = { status: "idle" | "error" | "success"; error?: string };

/** Radio names are `r:<studentId>:<skillId>`; the clicked button says close or hold. */
export async function saveStationCheckAction(
  _: CheckFormState,
  form: FormData,
): Promise<CheckFormState> {
  const { teacherId } = await requireTeacher();
  const results = [...form.entries()].flatMap(([key, value]) => {
    const [tag, studentId, skillId] = key.split(":");
    return tag === "r" ? [{ studentId, skillId, result: String(value) }] : [];
  });
  const parsed = checkSchema.safeParse({
    sessionId: text(form, "sessionId"),
    action: text(form, "action"),
    results,
  });
  if (!parsed.success) return { status: "error", error: "invalid" };
  const saved = await saveStationCheck(teacherId, parsed.data);
  if (!saved.ok) return { status: "error", error: saved.error };
  refresh();
  return { status: "success" };
}
