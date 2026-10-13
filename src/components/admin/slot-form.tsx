"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { ErrorAlert } from "@/components/ui/alert";
import { Field, SelectField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { addSlotAction, type FormState } from "@/server/funnel/actions";

const initial: FormState = { status: "idle" };

/** Mona adds one free time: a day from the next two weeks and a Tehran time. */
export function SlotForm({ days }: { days: { value: string; label: string }[] }) {
  const t = useTranslations("Admin.levelChecks");
  const [state, action] = useActionState(addSlotAction, initial);
  const err = (field: string) => {
    const key = state.fieldErrors?.[field];
    return key ? t(`errors.${key as "date"}`) : undefined;
  };
  const v = state.values ?? {};

  return (
    <form action={action} className="mt-5 space-y-4" noValidate>
      {state.error && <ErrorAlert>{t(`errors.${state.error as "past"}`)}</ErrorAlert>}
      {state.status === "success" && (
        <p role="status" className="font-semibold text-brand">
          {t("added")}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr_auto] sm:items-start">
        <SelectField
          label={t("date")}
          name="date"
          defaultValue={v.date || days[0]?.value}
          error={err("date")}
          options={days}
        />
        <Field
          label={t("time")}
          name="time"
          type="time"
          step={300}
          dir="ltr"
          required
          defaultValue={v.time}
          hint={t("timeHint")}
          error={err("time")}
        />
        <SubmitButton pendingLabel={t("adding")} className="sm:mt-7">
          {t("add")}
        </SubmitButton>
      </div>
    </form>
  );
}
