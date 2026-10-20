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
}: {
  children: ReactNode;
  pendingLabel: string;
  className?: string;
  variant?: ButtonVariant;
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
      className={buttonClass(variant, className)}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
