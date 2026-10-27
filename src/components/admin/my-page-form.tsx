"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Field, TextareaField } from "@/components/ui/field";
import { FormSuccess } from "@/components/ui/form-success";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateMyPageAction, type MyPageState } from "@/server/teachers/actions";

/** The teacher's brand name and bio, shown on their public page. The photo comes with M8. */
export function MyPageForm({
  url,
  brandName,
  bio,
}: {
  url: string;
  brandName: string;
  bio: string;
}) {
  const t = useTranslations("Admin.myPage");
  const [state, action] = useActionState(updateMyPageAction, {
    status: "idle",
    values: { brandName, bio },
  } as MyPageState);
  const v = state.values ?? {};
  const error = (field: "brandName" | "bio") =>
    state.fieldErrors?.[field] ? t(`errors.${field}`) : undefined;
  return (
    <form action={action} className="space-y-5 rounded-card border border-hairline bg-white p-6">
      <p>
        {t("address")}{" "}
        <a
          href={url}
          target="_blank"
          rel="noopener"
          dir="ltr"
          className="font-bold text-brand underline"
        >
          {url.replace(/^https?:\/\//, "")}
        </a>
      </p>
      {state.status === "success" && <FormSuccess>{t("saved")}</FormSuccess>}
      <Field
        name="brandName"
        label={t("brandName")}
        hint={t("brandHint")}
        defaultValue={v.brandName}
        error={error("brandName")}
        required
      />
      <TextareaField
        name="bio"
        label={t("bio")}
        hint={t("bioHint")}
        defaultValue={v.bio}
        error={error("bio")}
        rows={6}
        maxLength={1000}
      />
      <SubmitButton pendingLabel={t("saving")} className="w-full sm:w-auto">
        {t("save")}
      </SubmitButton>
    </form>
  );
}
