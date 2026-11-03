import { Readable } from "node:stream";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/current";
import { openFile } from "@/server/files/storage";
import { readableFile } from "@/server/homework/access";

/** `bytes=start-end` (Safari asks for audio in ranges); null when absent or unsatisfiable. */
function parseRange(header: string | null, size: number) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header ?? "");
  if (!m || (!m[1] && !m[2])) return null;
  const start = m[1] ? Number(m[1]) : Math.max(size - Number(m[2]), 0);
  const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  return start <= end && start < size ? { start, end } : null;
}

/** Uploaded files are served here only, after checking the signed-in user may read them. */
export async function GET(request: Request, { params }: RouteContext<"/api/files/[id]">) {
  const id = z.uuid().safeParse((await params).id);
  const user = await getCurrentUser();
  const file = user && id.success ? await readableFile(user.id, id.data) : null;
  if (!file) return new Response(null, { status: 404 });

  const inline = file.mime.startsWith("audio/") || file.mime.startsWith("image/");
  const range = parseRange(request.headers.get("range"), file.sizeBytes);
  const headers: Record<string, string> = {
    "Content-Type": file.mime,
    "Content-Length": String(range ? range.end - range.start + 1 : file.sizeBytes),
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
  };
  if (range) headers["Content-Range"] = `bytes ${range.start}-${range.end}/${file.sizeBytes}`;
  return new Response(Readable.toWeb(openFile(file.id, range ?? undefined)) as ReadableStream, {
    status: range ? 206 : 200,
    headers,
  });
}
