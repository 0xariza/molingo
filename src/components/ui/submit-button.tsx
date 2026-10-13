"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

const noopSubscribe = () => () => {};

/**
 * Disabled until hydrated: a native (pre-JS) submit of a Server Action form returns only the
 * streamed part of the page under Cache Components, so an early tap would show a blank page.
 */
export function SubmitButton({
  children,
  pendingLabel,
}: {
  children: ReactNode;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const disabled = pending || !hydrated;
  return (
    <button
      type="submit"
      disabled={disabled}
      aria-disabled={disabled}
      className="inline-flex min-h-touch w-full items-center justify-center rounded-pill bg-brand px-6 text-base font-bold text-white transition hover:bg-deep disabled:opacity-70"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
