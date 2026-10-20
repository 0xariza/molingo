"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { requireAdmin } from "../auth/current";
import { fieldErrors, formLocale, text } from "../forms";
import {
  createLearner,
  learnerDetailsSchema,
  learnerStatuses,
  markLeadLost,
  newLearnerSchema,
  setLearnerStatus,
  updateLearner,
} from "./learners";
import { createLogin, newLoginLink, type LoginLink, type LoginLinkResult } from "./login";

/** Error keys map to messages under `Admin.learners.errors`. */
export type LearnerFormState = {
  status: "idle" | "error" | "success";
  error?: "phone_taken" | "lead_unavailable" | "not_found";
  /** With `phone_taken`: the learner who already has the number. */
  existingId?: string | null;
  fieldErrors?: Record<string, string>;
  /** Submitted values, echoed back so React's post-action form reset doesn't wipe them. */
  values?: Record<string, string>;
  /** After saving with "create login": the new learner and the link to send them (shown once). */
  saved?: { id: string; name: string; phone: string; link: LoginLink };
};

const detailFields = ["fullNameFa", "fullNameEn", "phone", "email", "messengerHandle", "notes"];

const valuesOf = (form: FormData, keys: string[]) =>
  Object.fromEntries(keys.map((k) => [k, text(form, k)]));

export async function createLearnerAction(
  _: LearnerFormState,
  form: FormData,
): Promise<LearnerFormState> {
  const admin = await requireAdmin();
  const values = valuesOf(form, [...detailFields, "status", "leadId", "createLogin"]);
  const parsed = newLearnerSchema.safeParse({ ...values, leadId: values.leadId || undefined });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error.issues), values };
  }

  const result = await createLearner(parsed.data);
  if (!result.ok) {
    const existingId = result.error === "phone_taken" ? result.existingId : undefined;
    return { status: "error", error: result.error, existingId, values };
  }
  if (values.createLogin === "on") {
    const login = await createLogin(result.id, admin.id);
    if (login.ok) {
      const { url, kind, expiresAt } = login;
      const { fullNameFa: name, phone } = parsed.data;
      const link = { url, kind, expiresAt };
      return { status: "success", saved: { id: result.id, name, phone, link } };
    }
    // Saved, but the login couldn't be made (e.g. the number is Mona's): the profile shows why.
  }
  return redirect({ href: `/admin/students/${result.id}`, locale: formLocale(form) });
}

export async function updateLearnerAction(
  _: LearnerFormState,
  form: FormData,
): Promise<LearnerFormState> {
  await requireAdmin();
  const values = valuesOf(form, detailFields);
  const id = z.uuid().safeParse(text(form, "id"));
  if (!id.success) return { status: "error", error: "not_found", values };
  const parsed = learnerDetailsSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error.issues), values };
  }

  const result = await updateLearner(id.data, parsed.data);
  if (!result.ok) {
    const existingId = result.error === "phone_taken" ? result.existingId : undefined;
    return { status: "error", error: result.error, existingId, values };
  }
  return redirect({ href: `/admin/students/${id.data}`, locale: formLocale(form) });
}

const statusInput = z.object({ id: z.uuid(), status: z.enum(learnerStatuses) });

export async function setLearnerStatusAction(form: FormData): Promise<void> {
  await requireAdmin();
  const parsed = statusInput.safeParse({ id: text(form, "id"), status: text(form, "status") });
  if (!parsed.success) return;
  await setLearnerStatus(parsed.data.id, parsed.data.status);
  refresh();
}

export async function markLeadLostAction(form: FormData): Promise<void> {
  await requireAdmin();
  const leadId = z.uuid().safeParse(text(form, "leadId"));
  if (!leadId.success) return;
  await markLeadLost(leadId.data);
  refresh();
}

/** Error keys map to messages under `Admin.learners.login.errors`. */
export type LoginFormState =
  | { status: "idle" }
  | { status: "success"; link: LoginLink }
  | { status: "error"; error: Extract<LoginLinkResult, { ok: false }>["error"] };

async function loginLinkAction(
  form: FormData,
  issue: (studentId: string, adminId: string) => Promise<LoginLinkResult>,
): Promise<LoginFormState> {
  const admin = await requireAdmin();
  const id = z.uuid().safeParse(text(form, "id"));
  if (!id.success) return { status: "error", error: "not_found" };
  const result = await issue(id.data, admin.id);
  refresh();
  if (!result.ok) return { status: "error", error: result.error };
  const { url, kind, expiresAt } = result;
  return { status: "success", link: { url, kind, expiresAt } };
}

export async function createLoginAction(_: LoginFormState, form: FormData) {
  return loginLinkAction(form, createLogin);
}

export async function newLoginLinkAction(_: LoginFormState, form: FormData) {
  return loginLinkAction(form, newLoginLink);
}
