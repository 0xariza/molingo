"use client";

import { X } from "@phosphor-icons/react";
import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * A modal dialog on the native <dialog> element (focus trap, Esc and inert background come free).
 * Rendered only while open.
 */
export function Modal({
  title,
  description,
  closeLabel,
  onClose,
  children,
}: {
  title: string;
  description?: ReactNode;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-title`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-xl rounded-3xl bg-white p-0 text-body shadow-[0_24px_60px_rgba(7,30,54,.3)] backdrop:bg-ocean/45"
    >
      <div className="space-y-4 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id={`${id}-title`}
              className="font-sans text-xl font-extrabold normal-case tracking-normal"
            >
              {title}
            </h2>
            {description && <div className="mt-1 text-sm">{description}</div>}
          </div>
          <button
            type="button"
            aria-label={closeLabel}
            onClick={onClose}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-ocean hover:bg-mist"
          >
            <X aria-hidden size={16} weight="bold" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
