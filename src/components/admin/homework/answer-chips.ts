import type { StoredFile } from "@/server/homework/submissions";

type Chip = { kind: "text" | "voice" | "photo" | "file"; count: number; ext?: string };

const docType = (mime: string) => (mime === "application/pdf" ? "PDF" : "Word");

/** What an answer holds, for the queue: text, voice, photos (counted) and each document. */
export function answerChips(hasText: boolean, files: StoredFile[]): Chip[] {
  const chips: Chip[] = [];
  if (hasText) chips.push({ kind: "text", count: 1 });
  const voice = files.filter((f) => f.mime.startsWith("audio/")).length;
  if (voice) chips.push({ kind: "voice", count: voice });
  const photos = files.filter((f) => f.mime.startsWith("image/")).length;
  if (photos) chips.push({ kind: "photo", count: photos });
  for (const f of files.filter((f) => !f.mime.startsWith("audio/") && !f.mime.startsWith("image/")))
    chips.push({ kind: "file", count: 1, ext: docType(f.mime) });
  return chips;
}
