import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { files } from "@/db/schema";
import { MAX_FILE_BYTES, MAX_FILES } from "./limits";

export { MAX_FILES };

/** Declared types we accept: documents, images and audio (voice recordings included). */
const ALLOWED = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
  "audio/mp4",
  "audio/x-m4a",
  "audio/mpeg",
  "audio/webm",
  "audio/ogg",
]);

export type FileError = "file_type" | "file_size" | "file_count";

/** `audio/webm;codecs=opus` → `audio/webm`. */
const baseType = (type: string) => type.split(";")[0].trim().toLowerCase();

/** The upload form's real files (an empty file input still sends one empty entry). */
export const uploadedFiles = (form: FormData, key: string): File[] =>
  form.getAll(key).filter((f): f is File => f instanceof File && f.size > 0);

/**
 * `shortcut`: the type is the browser's declared one, not sniffed from the bytes. Files are only
 * ever served with `nosniff`, and documents as downloads, so a mislabelled file can't run.
 */
export function checkUploads(uploads: File[], alreadyKept = 0): FileError | null {
  if (uploads.length + alreadyKept > MAX_FILES) return "file_count";
  if (uploads.some((f) => !ALLOWED.has(baseType(f.type)))) return "file_type";
  if (uploads.some((f) => f.size > MAX_FILE_BYTES)) return "file_size";
  return null;
}

const uploadDir = () => process.env.UPLOAD_DIR ?? ".uploads";
const pathOf = (id: string) => join(uploadDir(), id);

/** Writes the bytes and the rows; the caller links the returned ids, or calls `deleteFiles`. */
export async function storeFiles(ownerUserId: string, uploads: File[]): Promise<string[]> {
  if (!uploads.length) return [];
  await mkdir(uploadDir(), { recursive: true });
  const rows = uploads.map((f) => ({
    id: randomUUID(),
    ownerUserId,
    originalName: f.name.slice(0, 200) || "file",
    mime: baseType(f.type),
    sizeBytes: f.size,
  }));
  await Promise.all(
    uploads.map(async (f, i) => writeFile(pathOf(rows[i].id), Buffer.from(await f.arrayBuffer()))),
  );
  await db.insert(files).values(rows);
  return rows.map((r) => r.id);
}

export async function deleteFiles(ids: string[]): Promise<void> {
  if (!ids.length) return;
  await db.delete(files).where(inArray(files.id, ids));
  await Promise.all(ids.map((id) => unlink(pathOf(id)).catch(() => {})));
}

export const openFile = (id: string, range?: { start: number; end: number }) =>
  createReadStream(pathOf(id), range);
