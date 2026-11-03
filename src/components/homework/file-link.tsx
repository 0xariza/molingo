import { FileText, Paperclip } from "@phosphor-icons/react/dist/ssr";
import type { Locale } from "@/i18n/routing";
import type { StoredFile } from "@/server/homework/submissions";

/** `240 KB` / `1.4 MB` in the locale's digits. */
export function fileSize(bytes: number, locale: Locale): string {
  const mb = bytes >= 1024 * 1024;
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: mb ? "megabyte" : "kilobyte",
    maximumFractionDigits: mb ? 1 : 0,
  }).format(mb ? bytes / (1024 * 1024) : Math.max(bytes / 1024, 1));
}

/** One stored file: audio plays in place, anything else is a download link. */
export function FileLink({ file, locale }: { file: StoredFile; locale: Locale }) {
  const href = `/api/files/${file.id}`;
  if (file.mime.startsWith("audio/"))
    return <audio controls preload="none" src={href} aria-label={file.name} className="w-full" />;
  const Icon = file.mime === "application/pdf" || file.mime.includes("word") ? FileText : Paperclip;
  return (
    <a
      href={href}
      className="inline-flex min-h-touch items-center gap-2 rounded-2xl border border-hairline px-3.5 font-semibold text-ocean hover:border-brand"
    >
      <Icon aria-hidden size={18} />
      <span dir="auto" className="min-w-0 truncate">
        {file.name}
      </span>
      <span className="shrink-0 text-sm font-normal text-body">{fileSize(file.size, locale)}</span>
    </a>
  );
}
