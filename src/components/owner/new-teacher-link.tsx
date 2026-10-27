"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { LinkPanel } from "@/components/admin/learners/link-panel";
import { ErrorAlert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { newTeacherLinkAction, type TeacherFormState } from "@/server/teachers/actions";

const initial: TeacherFormState = { status: "idle" };

/** A fresh activation link for a teacher who hasn't set their password yet. */
export function NewTeacherLink({ id, phone }: { id: string; phone: string }) {
  const t = useTranslations("Owner");
  const [state, action] = useActionState(newTeacherLinkAction, initial);
  return (
    <div className="contents">
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <SubmitButton variant="ghost" pendingLabel={t("making")} className="w-auto">
          {t("newLink")}
        </SubmitButton>
      </form>
      {state.status === "error" && <ErrorAlert>{t("errors.not_found")}</ErrorAlert>}
      {state.link && (
        <div className="w-full">
          <LinkPanel link={state.link} phone={phone} />
        </div>
      )}
    </div>
  );
}
