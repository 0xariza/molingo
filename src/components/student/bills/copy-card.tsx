"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { buttonClass } from "@/components/ui/button";

/** The teacher's card number, ready to copy. */
export function CopyCard({ number }: { number: string }) {
  const t = useTranslations("Student.bills");
  const [copied, setCopied] = useState(false);
  const spaced = number.replace(/(\d{4})(?=\d)/g, "$1 ");
  return (
    <div className="space-y-2">
      <b dir="ltr" className="block text-start text-2xl tracking-widest text-ocean">
        {spaced}
      </b>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(number);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
        className={buttonClass("ghostLight", "min-h-10 text-sm")}
      >
        {copied ? t("copied") : t("copy")}
      </button>
    </div>
  );
}
