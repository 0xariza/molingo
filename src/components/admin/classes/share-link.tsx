"use client";

import { Check, LinkSimple } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { buttonClass } from "@/components/ui/button";

/** Copies the class's share link (`/j/<classId>`) for Mona to post in WhatsApp or Telegram. */
export function ShareLinkButton({ url }: { url: string }) {
  const t = useTranslations("Admin.classes");
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      }}
      className={buttonClass("ghost")}
    >
      {copied ? <Check aria-hidden size={18} /> : <LinkSimple aria-hidden size={18} />}
      <span aria-live="polite">{copied ? t("detail.shareCopied") : t("detail.share")}</span>
    </button>
  );
}
