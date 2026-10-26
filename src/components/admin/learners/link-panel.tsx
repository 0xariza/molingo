"use client";

import { Check, Copy, TelegramLogo, WhatsappLogo } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { buttonClass } from "@/components/ui/button";
import type { Locale } from "@/i18n/routing";
import { formatDate } from "@/lib/format";
import type { LoginLink } from "@/server/students/login";

/**
 * A one-time link for Mona to send: copy it, or open WhatsApp/Telegram with it. A login link
 * says when it expires; any other link brings its own note.
 */
export function LinkPanel({
  link,
  phone,
}: {
  link: LoginLink | { url: string; note: string };
  phone: string;
}) {
  const t = useTranslations("Admin.learners.login");
  const locale = useLocale() as Locale;
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(link.url);
    setCopied(true);
  }

  return (
    <div className="space-y-3 rounded-2xl border border-whale bg-mist/50 p-4">
      <p className="font-semibold text-ocean">{t("sendThis")}</p>
      <div className="flex items-center gap-2">
        <input
          readOnly
          dir="ltr"
          aria-label={t("linkLabel")}
          value={link.url}
          onFocus={(e) => e.currentTarget.select()}
          className="min-h-touch min-w-0 flex-1 rounded-xl border border-line/50 bg-white px-3 font-mono text-sm text-ocean"
        />
        <button type="button" onClick={copy} className={buttonClass("primary", "shrink-0 px-4")}>
          {copied ? <Check aria-hidden size={18} /> : <Copy aria-hidden size={18} />}
          {copied ? t("copied") : t("copy")}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <a
          href={`https://wa.me/${phone.replace("+", "")}?text=${encodeURIComponent(link.url)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass("ghost", "px-4 text-sm")}
        >
          <WhatsappLogo aria-hidden size={18} />
          {t("whatsapp")}
        </a>
        <a
          href={`https://t.me/share/url?url=${encodeURIComponent(link.url)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass("ghost", "px-4 text-sm")}
        >
          <TelegramLogo aria-hidden size={18} />
          {t("telegram")}
        </a>
      </div>
      <p className="text-sm">
        {"note" in link
          ? link.note
          : t(link.kind === "activation" ? "activationNote" : "resetNote", {
              date: formatDate(new Date(link.expiresAt), locale, { year: false }),
            })}
      </p>
    </div>
  );
}
