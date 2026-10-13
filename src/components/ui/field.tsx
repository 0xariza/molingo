import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

export const inputClass =
  "min-h-13 w-full rounded-2xl border-[1.5px] border-line bg-surface px-4 text-base text-ocean placeholder:text-body/60 outline-none transition hover:border-body focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/15 aria-[invalid=true]:border-red-600 aria-[invalid=true]:bg-red-50/40";

type ShellProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: (aria: { id: string; "aria-invalid"?: true; "aria-describedby"?: string }) => ReactNode;
};

/** Label above, control, then error (or hint) below, wired up with aria-describedby. */
function FieldShell({ id, label, hint, error, children }: ShellProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-bold text-ocean">
        {label}
      </label>
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": [errorId, hintId].filter(Boolean).join(" ") || undefined,
      })}
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

type Common = { label: string; name: string; hint?: string; error?: string };

type FieldProps = InputHTMLAttributes<HTMLInputElement> &
  Common & {
    /** Rendered inside the input row, after the input (e.g. a show-password button). */
    trailing?: ReactNode;
  };

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
  return (
    <FieldShell id={id ?? `f-${name}`} label={label} hint={hint} error={error}>
      {(aria) => (
        <div className="relative">
          <input
            name={name}
            className={`${inputClass} ${trailing ? "pe-14" : ""} ${className}`}
            {...aria}
            {...input}
          />
          {trailing && (
            <div className="absolute inset-y-0 end-0 flex items-center pe-1">{trailing}</div>
          )}
        </div>
      )}
    </FieldShell>
  );
}

export function TextareaField({
  label,
  name,
  hint,
  error,
  id,
  ...textarea
}: TextareaHTMLAttributes<HTMLTextAreaElement> & Common) {
  return (
    <FieldShell id={id ?? `f-${name}`} label={label} hint={hint} error={error}>
      {(aria) => (
        <textarea name={name} rows={3} className={`${inputClass} py-3`} {...aria} {...textarea} />
      )}
    </FieldShell>
  );
}

export function SelectField({
  label,
  name,
  hint,
  error,
  id,
  options,
  ...select
}: SelectHTMLAttributes<HTMLSelectElement> &
  Common & { options: { value: string; label: string }[] }) {
  return (
    <FieldShell id={id ?? `f-${name}`} label={label} hint={hint} error={error}>
      {(aria) => (
        <select name={name} className={inputClass} {...aria} {...select}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  );
}
