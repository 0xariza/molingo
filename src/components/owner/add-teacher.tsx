"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { LinkPanel } from "@/components/admin/learners/link-panel";
import { ErrorAlert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { createTeacherAction, type TeacherFormState } from "@/server/teachers/actions";

const initial: TeacherFormState = { status: "idle" };

/** The owner's "Add a teacher" card: name, brand, mobile, page address → activation link. */
export function AddTeacher({ host }: { host: string }) {
  const t = useTranslations("Owner");
  const [state, action] = useActionState(createTeacherAction, initial);
  const v = state.values ?? {};
  const error = (field: string) => {
    const key = state.fieldErrors?.[field];
    return key ? t(`errors.${key as "slug"}`) : undefined;
  };
  return (
    <section className="space-y-4 rounded-card border border-hairline bg-white p-6">
      <h2 className="font-sans text-xl font-bold tracking-normal normal-case">{t("add.title")}</h2>
      {state.status === "success" && state.link && (
        <LinkPanel link={state.link} phone={state.phone ?? ""} />
      )}
      {state.error && <ErrorAlert>{t(`errors.${state.error}`)}</ErrorAlert>}
      <form
        action={action}
        className="space-y-4"
        key={state.status === "success" ? "done" : "form"}
      >
        <Field
          name="nameFa"
          label={t("add.nameFa")}
          defaultValue={v.nameFa}
          error={error("nameFa")}
          dir="rtl"
          required
        />
        <Field
          name="nameEn"
          label={t("add.nameEn")}
          defaultValue={v.nameEn}
          error={error("nameEn")}
          dir="ltr"
          required
        />
        <Field
          name="brandName"
          label={t("add.brandName")}
          hint={t("add.brandHint")}
          defaultValue={v.brandName}
          error={error("brandName")}
          required
        />
        <Field
          name="phone"
          type="tel"
          inputMode="tel"
          dir="ltr"
          label={t("add.phone")}
          defaultValue={v.phone}
          error={error("phone")}
          required
        />
        <Field
          name="slug"
          dir="ltr"
          label={t("add.slug", { host })}
          hint={t("add.slugHint")}
          defaultValue={v.slug}
          error={error("slug")}
          autoCapitalize="none"
          required
        />
        <SubmitButton pendingLabel={t("add.saving")}>{t("add.submit")}</SubmitButton>
      </form>
    </section>
  );
}
