"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { ErrorAlert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { Field, TextareaField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatNumber, toLatinDigits } from "@/lib/format";
import { updateClassAction, type ClassFormState } from "@/server/classes/actions";
import { LevelPicker } from "./level-picker";

const initial: ClassFormState = { status: "idle" };

/** What can change after a class exists: name, level, seats, tuition and how it's shown. */
export function EditClassForm({
  cls,
}: {
  cls: {
    id: string;
    nameFa: string;
    nameEn: string | null;
    level: string;
    type: "private" | "group";
    capacity: number;
    priceToman: number;
    description: string | null;
    isPublic: boolean;
  };
}) {
  const t = useTranslations("Admin.classes");
  const locale = useLocale() as Locale;
  const [state, action] = useActionState(updateClassAction, initial);
  const [level, setLevel] = useState(cls.level);
  const [capacity, setCapacity] = useState(cls.capacity);
  const [price, setPrice] = useState(String(cls.priceToman));
  const err = (field: string) => {
    const key = state.fieldErrors?.[field];
    return key ? t(`errors.${key as "nameFa"}`) : undefined;
  };

  return (
    <form
      action={action}
      noValidate
      className="space-y-5 rounded-card border border-hairline bg-white p-6 sm:p-7"
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={cls.id} />
      <input type="hidden" name="capacity" value={capacity} />
      <input type="hidden" name="price" value={price} />
      {state.error && <ErrorAlert>{t(`errors.${state.error as "capacity"}`)}</ErrorAlert>}
      <p className="rounded-2xl bg-surface px-4 py-3 text-sm">{t("form.editNote")}</p>
      <div className="grid items-start gap-5 sm:grid-cols-2">
        <Field
          label={t("form.nameFa")}
          name="nameFa"
          lang="fa"
          dir="rtl"
          defaultValue={cls.nameFa}
          autoComplete="off"
          error={err("nameFa")}
        />
        <Field
          label={t("form.nameEn")}
          name="nameEn"
          lang="en"
          dir="ltr"
          defaultValue={cls.nameEn ?? ""}
          autoComplete="off"
          hint={t("form.nameEnHint")}
          error={err("nameEn")}
        />
      </div>
      <LevelPicker value={level} onChange={setLevel} />
      {cls.type === "group" && (
        <fieldset>
          <legend className="mb-1.5 text-sm font-bold text-ocean">{t("form.capacity")}</legend>
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-mist p-1">
            {[2, 3, 4].map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={capacity === c}
                onClick={() => setCapacity(c)}
                className="min-h-12 rounded-xl font-bold text-body aria-pressed:bg-white aria-pressed:text-ocean aria-pressed:shadow-[0_1px_3px_rgba(7,30,54,.12)]"
              >
                {t("form.capacityOption", { count: formatNumber(c, locale) })}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <div className="space-y-1.5">
        <label htmlFor="price" className="block text-sm font-bold text-ocean">
          {cls.type === "private" ? t("form.pricePrivate") : t("form.priceGroup")}
        </label>
        <div className="flex h-12 items-center overflow-hidden rounded-2xl border-[1.5px] border-line bg-white focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15">
          <input
            id="price"
            inputMode="numeric"
            dir="ltr"
            value={price ? formatNumber(Number(price), locale) : ""}
            onChange={(e) =>
              setPrice(toLatinDigits(e.target.value).replace(/\D/g, "").slice(0, 10))
            }
            className="h-full min-w-0 flex-1 px-4 text-end text-lg font-bold text-ocean outline-none"
          />
          <span className="flex h-full items-center border-s border-mist bg-surface px-4 font-semibold">
            {t("form.toman")}
          </span>
        </div>
        {err("price") && <p className="text-sm font-medium text-red-700">{err("price")}</p>}
      </div>
      <TextareaField
        label={t("form.description")}
        name="description"
        defaultValue={cls.description ?? ""}
        error={err("description")}
      />
      {cls.type === "group" && (
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="isPublic"
            defaultChecked={cls.isPublic}
            className="mt-1 size-4.5 accent-brand"
          />
          <span className="leading-snug">
            <span className="block font-bold text-ocean">{t("form.isPublic")}</span>
            <span className="text-sm">{t("form.isPublicHint")}</span>
          </span>
        </label>
      )}
      <div className="flex flex-wrap justify-end gap-3 border-t border-mist pt-5">
        <Link href={`/admin/classes/${cls.id}`} className={buttonClass("ghost")}>
          {t("form.cancel")}
        </Link>
        <SubmitButton pendingLabel={t("form.saving")} className="w-full sm:w-auto">
          {t("form.save")}
        </SubmitButton>
      </div>
    </form>
  );
}
