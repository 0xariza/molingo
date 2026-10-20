"use client";

import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { toLatinDigits } from "@/lib/format";
import { popover } from "./select-menu";

export type ComboItem = {
  id: string;
  primary: string;
  secondary?: string | null;
  /** Shown under the names (e.g. phone · status). */
  meta?: ReactNode;
  /** Extra text the search matches (e.g. the phone number). */
  keywords?: string;
  disabled?: boolean;
  tag?: ReactNode;
};

const digitsOf = (v: string) =>
  toLatinDigits(v)
    .replace(/\D/g, "")
    .replace(/^(0098|98|0)/, "");

/** Matches either name (any case) or, from 3 digits on, the number however it's typed. */
export function matches(item: ComboItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (item.primary.toLowerCase().includes(q) || item.secondary?.toLowerCase().includes(q))
    return true;
  const digits = digitsOf(q);
  return digits.length >= 3 && digitsOf(item.keywords ?? "").includes(digits);
}

/** A search box with a list of matches (WAI-ARIA combobox). Disabled items stay visible, last. */
export function Combobox({
  label,
  placeholder,
  items,
  onPick,
  empty,
  autoFocus,
  labelHidden,
  clearLabel,
}: {
  label: string;
  placeholder: string;
  items: ComboItem[];
  onPick: (item: ComboItem) => void;
  empty: (query: string) => ReactNode;
  autoFocus?: boolean;
  labelHidden?: boolean;
  clearLabel: string;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(!!autoFocus);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const found = items
    .filter((i) => matches(i, query))
    .sort((a, b) => Number(!!a.disabled) - Number(!!b.disabled));

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  function pick(item: ComboItem | undefined) {
    if (!item || item.disabled) return;
    onPick(item);
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") setActive((i) => Math.min(i + 1, found.length - 1));
    else if (e.key === "ArrowUp") setActive((i) => Math.max(i - 1, 0));
    else if (e.key === "Enter") pick(found[active]);
    else if (e.key === "Escape") setOpen(false);
    else return;
    e.preventDefault();
    setOpen(true);
  }

  return (
    <div ref={root} className="relative space-y-1.5">
      <label
        htmlFor={id}
        className={labelHidden ? "sr-only" : "block text-sm font-bold text-ocean"}
      >
        {label}
      </label>
      <div className="flex h-12 items-center gap-2 rounded-2xl border-[1.5px] border-line bg-white px-3 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15">
        <MagnifyingGlass aria-hidden size={18} className="shrink-0 text-body" />
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={open && found[active] ? `${id}-${active}` : undefined}
          autoComplete="off"
          autoFocus={autoFocus}
          value={query}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent text-ocean outline-none placeholder:text-body/60"
        />
        {query && (
          <button
            type="button"
            aria-label={clearLabel}
            onClick={() => setQuery("")}
            className="grid size-8 place-items-center rounded-full bg-mist text-body"
          >
            <X aria-hidden size={14} weight="bold" />
          </button>
        )}
      </div>
      {open && (
        <ul id={`${id}-list`} role="listbox" aria-label={label} className={popover}>
          {found.length === 0 && <li className="p-3 text-center">{empty(query)}</li>}
          {found.map((item, i) => (
            <li
              key={item.id}
              id={`${id}-${i}`}
              role="option"
              aria-selected={i === active}
              aria-disabled={item.disabled || undefined}
              onPointerEnter={() => setActive(i)}
              onClick={() => pick(item)}
              className={`flex min-h-14 items-center gap-3 rounded-xl px-3 py-2 ${
                item.disabled ? "cursor-default opacity-55" : "cursor-pointer"
              } ${i === active && !item.disabled ? "bg-surface" : ""}`}
            >
              <span
                aria-hidden="true"
                className="grid size-9 shrink-0 place-items-center rounded-full bg-mist font-extrabold text-brand"
              >
                {item.primary.slice(0, 1)}
              </span>
              <span className="min-w-0 flex-1 leading-snug">
                <span className="block truncate font-bold text-ocean">
                  {item.primary}{" "}
                  {item.secondary && (
                    <span className="font-semibold text-body">{item.secondary}</span>
                  )}
                </span>
                {item.meta && <span className="block text-sm">{item.meta}</span>}
              </span>
              {item.tag && (
                <span className="shrink-0 rounded-pill bg-mist px-2.5 text-xs font-bold text-brand">
                  {item.tag}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
