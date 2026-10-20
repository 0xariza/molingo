"use client";

import { CalendarBlank } from "@phosphor-icons/react";
import { useLocale } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { DayPicker as PersianDayPicker } from "react-day-picker/persian";
import "react-day-picker/style.css";
import type { Locale } from "@/i18n/routing";
import { formatDate, fromTehranTime } from "@/lib/format";

/** Calendar dates as "YYYY-MM-DD"; the picker's Date objects are local midnights of those days. */
const toDate = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const toKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/**
 * A date field with a calendar: Persian (Jalali) in Persian, Gregorian in English. `allowed`
 * decides which days can be picked (e.g. only the class's weekdays, from today on).
 */
export function DatePicker({
  label,
  name,
  value,
  onChange,
  allowed,
  placeholder,
  error,
  hint,
  disabled,
}: {
  label: string;
  disabled?: boolean;
  name?: string;
  value: string;
  onChange: (key: string) => void;
  allowed: (key: string) => boolean;
  placeholder: string;
  error?: string;
  hint?: string;
}) {
  const locale = useLocale() as Locale;
  const id = useId();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const Picker = locale === "fa" ? PersianDayPicker : DayPicker;

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={root} className="relative space-y-1.5">
      <span id={`${id}-label`} className="block text-sm font-bold text-ocean">
        {label}
      </span>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        aria-labelledby={`${id}-label ${id}-value`}
        data-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onClick={() => setOpen((o) => !o)}
        className="flex h-12 w-full items-center justify-between gap-3 rounded-2xl border-[1.5px] border-line bg-white px-4 text-start font-semibold text-ocean outline-none hover:border-body focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-brand/15 aria-expanded:border-brand disabled:cursor-not-allowed disabled:bg-surface data-[invalid=true]:border-red-600"
      >
        <span id={`${id}-value`} className={value ? "" : "font-medium text-body/60"}>
          {value ? formatDate(fromTehranTime(value, "12:00"), locale) : placeholder}
        </span>
        <CalendarBlank aria-hidden size={18} className="shrink-0 text-body" />
      </button>
      {open && (
        <div
          role="dialog"
          aria-labelledby={`${id}-label`}
          className="absolute start-0 top-[calc(100%+6px)] z-30 rounded-2xl border border-line/40 bg-white p-3 shadow-[0_16px_40px_rgba(7,30,54,.14)]"
        >
          <Picker
            mode="single"
            autoFocus
            selected={value ? toDate(value) : undefined}
            defaultMonth={value ? toDate(value) : undefined}
            disabled={(date: Date) => !allowed(toKey(date))}
            onSelect={(date: Date | undefined) => {
              if (!date) return;
              onChange(toKey(date));
              setOpen(false);
            }}
          />
        </div>
      )}
      {error ? (
        <p id={`${id}-error`} className="text-sm font-medium text-red-700">
          {error}
        </p>
      ) : (
        hint && <p className="text-sm text-body/80">{hint}</p>
      )}
    </div>
  );
}
