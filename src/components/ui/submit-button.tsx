"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass, type ButtonVariant } from "./button";

const noopSubscribe = () => () => {};

/**
 * Disabled until hydrated: a native (pre-JS) submit of a Server Action form returns only the
 * streamed part of the page under Cache Components, so an early tap would show a blank page.
 */
export function SubmitButton({
  children,
  pendingLabel,
  className = "w-full",
  variant = "primary",
  blocked = false,
  name,
  value,
}: {
  children: ReactNode;
  pendingLabel: string;
  className?: string;
  variant?: ButtonVariant;
  /** The form isn't ready to send yet. */
  blocked?: boolean;
  /** For forms with several submit buttons: which one was pressed. */
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const disabled = pending || !hydrated || blocked;
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={disabled}
      aria-disabled={disabled}
      className={buttonClass(variant, className)}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
