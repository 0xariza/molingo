"use client";

import { CaretDown, Check } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export type MenuOption = { value: string; label: ReactNode; hint?: ReactNode; disabled?: boolean };

const trigger =
  "flex h-12 w-full items-center justify-between gap-3 rounded-2xl border-[1.5px] border-line bg-white px-4 text-start font-semibold text-ocean outline-none transition hover:border-body focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-brand/15 aria-expanded:border-brand aria-expanded:ring-4 aria-expanded:ring-brand/15 aria-[invalid=true]:border-red-600";

export const popover =
  "absolute inset-x-0 top-[calc(100%+6px)] z-30 max-h-72 overflow-y-auto rounded-2xl border border-line/40 bg-white p-1.5 shadow-[0_16px_40px_rgba(7,30,54,.14)]";

/**
 * A dropdown that looks the same everywhere (native <select> can't be styled). Keyboard: arrows,
 * Enter/Space, Esc. Submits its value through a hidden input when `name` is given.
 */
export function SelectMenu({
  label,
  name,
  value,
  options,
  onChange,
  placeholder,
  error,
  hint,
  labelHidden,
}: {
  label: string;
  /** Keep the label for screen readers only (e.g. under a column header). */
  labelHidden?: boolean;
  name?: string;
  value: string;
  options: MenuOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  hint?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  function show() {
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.value === value),
      ),
    );
    setOpen(true);
  }

  function pick(o: MenuOption) {
    if (o.disabled) return;
    onChange(o.value);
    setOpen(false);
    button.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        show();
      }
      return;
    }
    const step = (dir: number) => {
      let i = active;
      for (let n = 0; n < options.length; n++) {
        i = (i + dir + options.length) % options.length;
        if (!options[i].disabled) break;
      }
      setActive(i);
    };
    if (e.key === "ArrowDown") step(1);
    else if (e.key === "ArrowUp") step(-1);
    else if (e.key === "Enter" || e.key === " ") pick(options[active]);
    else if (e.key === "Escape" || e.key === "Tab") setOpen(false);
    else return;
    if (e.key !== "Tab") e.preventDefault();
  }

  return (
    <div ref={root} className="relative space-y-1.5">
      <span
        id={`${id}-label`}
        className={labelHidden ? "sr-only" : "block text-sm font-bold text-ocean"}
      >
        {label}
      </span>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        ref={button}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label ${id}-value`}
        aria-invalid={error ? true : undefined}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        aria-controls={`${id}-list`}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        className={trigger}
      >
        <span id={`${id}-value`} className={selected ? "" : "font-medium text-body/60"}>
          {selected?.label ?? placeholder}
        </span>
        <CaretDown aria-hidden size={18} className="shrink-0 text-body" />
      </button>
      {open && (
        <ul id={`${id}-list`} role="listbox" aria-labelledby={`${id}-label`} className={popover}>
          {options.map((o, i) => (
            <li
              key={o.value}
              id={`${id}-${i}`}
              role="option"
              aria-selected={o.value === value}
              aria-disabled={o.disabled || undefined}
              onPointerEnter={() => setActive(i)}
              onClick={() => pick(o)}
              className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl px-3 ${
                o.disabled
                  ? "cursor-default text-body/50"
                  : o.value === value
                    ? "bg-mist font-bold text-brand"
                    : i === active
                      ? "bg-surface text-ocean"
                      : "text-ocean"
              }`}
            >
              <span>
                {o.label}{" "}
                {o.hint && <span className="text-sm font-normal text-body">{o.hint}</span>}
              </span>
              {o.value === value && <Check aria-hidden size={18} weight="bold" />}
            </li>
          ))}
        </ul>
      )}
      {error ? (
        <p className="text-sm font-medium text-red-700">{error}</p>
      ) : (
        hint && <p className="text-sm text-body/80">{hint}</p>
      )}
    </div>
  );
}
