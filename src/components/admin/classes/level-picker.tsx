"use client";

import { useTranslations } from "next-intl";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

/** The class level as six pressable buttons (code + name), submitted through a hidden input. */
export function LevelPicker({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (level: string) => void;
  error?: string;
}) {
  const t = useTranslations("Admin.classes");
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-bold text-ocean">{t("form.level")}</legend>
      <input type="hidden" name="level" value={value} />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {LEVELS.map((l) => (
          <button
            key={l}
            type="button"
            aria-pressed={value === l}
            onClick={() => onChange(l)}
            className="flex min-h-16 flex-col items-center justify-center rounded-2xl border-[1.5px] border-line/50 bg-white px-2 text-ocean transition hover:border-brand aria-pressed:border-ocean aria-pressed:bg-ocean aria-pressed:text-white"
          >
            <bdi dir="ltr" className="text-lg font-extrabold leading-tight">
              {l}
            </bdi>
            <span className="text-xs font-semibold leading-tight opacity-80">
              {t(`levels.${l}`)}
            </span>
          </button>
        ))}
      </div>
      {error && <p className="mt-1.5 text-sm font-medium text-red-700">{error}</p>}
    </fieldset>
  );
}
