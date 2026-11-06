"use client";

import { Minus, Plus } from "@phosphor-icons/react";

/** − value + for a small whole number, submitted through a hidden input. */
export function Stepper({
  id,
  label,
  name,
  value,
  min,
  max,
  display,
  onChange,
  lessLabel,
  moreLabel,
}: {
  id: string;
  label: string;
  name: string;
  value: number;
  min: number;
  max: number;
  /** The value as shown (localized digits). */
  display: string;
  onChange: (value: number) => void;
  lessLabel: string;
  moreLabel: string;
}) {
  return (
    <div className="space-y-1.5">
      <span id={id} className="block text-sm font-bold text-ocean">
        {label}
      </span>
      <input type="hidden" name={name} value={value} />
      <div
        role="group"
        aria-labelledby={id}
        className="flex h-12 items-center overflow-hidden rounded-2xl border-[1.5px] border-line bg-white"
      >
        <button
          type="button"
          aria-label={lessLabel}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="grid h-full w-13 place-items-center text-brand hover:bg-surface disabled:text-line/50"
        >
          <Minus aria-hidden size={18} weight="bold" />
        </button>
        <span className="grid h-full min-w-12 flex-1 place-items-center border-x border-mist text-lg font-extrabold text-ocean">
          {display}
        </span>
        <button
          type="button"
          aria-label={moreLabel}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="grid h-full w-13 place-items-center text-brand hover:bg-surface disabled:text-line/50"
        >
          <Plus aria-hidden size={18} weight="bold" />
        </button>
      </div>
    </div>
  );
}
