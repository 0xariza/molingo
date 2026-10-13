import type { InputHTMLAttributes, ReactNode } from "react";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  hint?: string;
  error?: string;
  /** Rendered inside the input row, after the input (e.g. a show-password button). */
  trailing?: ReactNode;
};

export const inputClass =
  "min-h-touch w-full rounded-2xl border border-mist bg-white px-4 text-base text-ocean placeholder:text-body/60 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 aria-[invalid=true]:border-red-600";

/** Labelled input with hint and error wired up via aria-describedby. */
export function Field({
  label,
  name,
  hint,
  error,
  trailing,
  id,
  className = "",
  ...input
}: FieldProps) {
  const inputId = id ?? `f-${name}`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-semibold text-ocean">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          name={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={[errorId, hintId].filter(Boolean).join(" ") || undefined}
          className={`${inputClass} ${trailing ? "pe-14" : ""} ${className}`}
          {...input}
        />
        {trailing && (
          <div className="absolute inset-y-0 end-0 flex items-center pe-1">{trailing}</div>
        )}
      </div>
      {error && (
        <p id={errorId} className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={hintId} className="text-sm text-body/80">
          {hint}
        </p>
      )}
    </div>
  );
}
