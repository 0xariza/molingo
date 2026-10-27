"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireOwner, requireTeacher } from "../auth/current";
import { fieldErrors, text } from "../forms";
import { issueLink, type LoginLink } from "../students/login";
import {
  createTeacher,
  myPageSchema,
  newTeacherSchema,
  pendingTeacherUser,
  setTeacherActive,
  updateMyPage,
} from "./teachers";

/** Error keys map to messages under `Owner.errors`. */
export type TeacherFormState = {
  status: "idle" | "success" | "error";
  error?: "phone_taken" | "slug_taken" | "not_found";
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
  /** The new teacher's activation link, shown once. */
  link?: LoginLink;
  phone?: string;
};

const fields = ["nameFa", "nameEn", "brandName", "phone", "slug"];

/** The owner adds a teacher and gets their activation link to send. */
export async function createTeacherAction(
  _: TeacherFormState,
  form: FormData,
): Promise<TeacherFormState> {
  const owner = await requireOwner();
  const values = Object.fromEntries(fields.map((k) => [k, text(form, k)]));
  const parsed = newTeacherSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error.issues), values };
  }
  const result = await createTeacher(parsed.data);
  if (!result.ok) return { status: "error", error: result.error, values };
  const link = await issueLink(result.userId, "activation", "fa", owner.id);
  refresh();
  return { status: "success", link, phone: parsed.data.phone };
}

/** A fresh activation link for a teacher who hasn't set a password yet. */
export async function newTeacherLinkAction(
  _: TeacherFormState,
  form: FormData,
): Promise<TeacherFormState> {
  const owner = await requireOwner();
  const id = z.uuid().safeParse(text(form, "id"));
  const userId = id.success ? await pendingTeacherUser(id.data) : null;
  if (!userId) return { status: "error", error: "not_found" };
  const link = await issueLink(userId, "activation", "fa", owner.id);
  return { status: "success", link };
}

export async function setTeacherActiveAction(form: FormData): Promise<void> {
  await requireOwner();
  const id = z.uuid().safeParse(text(form, "id"));
  if (!id.success) return;
  await setTeacherActive(id.data, text(form, "active") === "1");
  refresh();
}

export type MyPageState = {
  status: "idle" | "success" | "error";
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

/** The teacher edits their own brand name and bio. */
export async function updateMyPageAction(_: MyPageState, form: FormData): Promise<MyPageState> {
  const { teacherId } = await requireTeacher();
  const values = { brandName: text(form, "brandName"), bio: text(form, "bio") };
  const parsed = myPageSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error.issues), values };
  }
  await updateMyPage(teacherId, parsed.data);
  refresh();
  return { status: "success", values };
}
