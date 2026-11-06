"use server";

import { refresh } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { requireTeacher } from "../auth/current";
import { fieldErrors, formLocale, text } from "../forms";
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
