"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { AttachmentPicker } from "@/components/homework/attachment-picker";
import { ErrorAlert } from "@/components/ui/alert";
import { TextareaField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { submitAnswerAction, type HomeworkFormState } from "@/server/homework/actions";

const initial: HomeworkFormState = { status: "idle" };

/** The learner's answer: text, files and a voice recording. Editable until it is reviewed. */
export function AnswerForm({
  assignmentId,
  teacher,
  body,
  kept,
  handedIn,
}: {
  assignmentId: string;
  teacher: string;
  body: string | null;
  kept: { id: string; name: string }[];
  /** An answer already went in: the button says "send again". */
  handedIn: boolean;
}) {
  const t = useTranslations("Student.homework");
  const [state, action] = useActionState(submitAnswerAction, initial);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      {state.status === "error" && (
        <ErrorAlert>
          {t(`errors.${(state.fieldErrors?.body ?? state.error ?? "empty") as "empty"}`)}
        </ErrorAlert>
      )}
      <TextareaField
        label={t("yourAnswer")}
        name="body"
        rows={6}
        dir="auto"
        defaultValue={body ?? ""}
        maxLength={8000}
      />
      <AttachmentPicker recorder kept={kept} />
      {state.status === "success" && (
        <p role="status" className="font-bold text-[#14613a]">
          {t("submitted")}
        </p>
      )}
      <SubmitButton pendingLabel={t("sending")}>
        {handedIn ? t("resend") : t("send", { teacher })}
      </SubmitButton>
      <p className="text-center text-sm">{t("editNote", { teacher })}</p>
    </form>
  );
}
