"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { AttachmentPicker } from "@/components/homework/attachment-picker";
import { ErrorAlert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { saveRecordingAction, type CheckFormState } from "@/server/paths/actions";

const initial: CheckFormState = { status: "idle" };

/** Record the 30-second "before" (or a later "after") with the same recorder as homework. */
export function RecordingForm({ kind }: { kind: "before" | "after" }) {
  const t = useTranslations("Student.progress");
  const [state, action] = useActionState(saveRecordingAction, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="kind" value={kind} />
      {state.status === "error" && <ErrorAlert>{t(`errors.${state.error as "empty"}`)}</ErrorAlert>}
      <AttachmentPicker recorder />
      {state.status === "success" && <p role="status">{t("saved")}</p>}
      <SubmitButton pendingLabel={t("saving")}>
        {t(kind === "before" ? "saveBefore" : "saveAfter")}
      </SubmitButton>
    </form>
  );
}
