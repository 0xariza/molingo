import { connection } from "next/server";
import { requireTeacher } from "@/server/auth/current";
import { draftHomework, draftSchema } from "@/server/homework/draft";

const status = { not_held: 404, rate_limited: 429, ai_failed: 502 } as const;

/** Streams an AI draft (title, blank line, instructions) as plain text. */
export async function POST(request: Request) {
  await connection();
  const teacher = await requireTeacher();
  const parsed = draftSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "ai_failed" }, { status: 400 });

  const draft = await draftHomework(teacher.teacherId, parsed.data);
  if (!draft.ok) return Response.json({ error: draft.error }, { status: status[draft.error] });

  const encoder = new TextEncoder();
  const text = draft.text[Symbol.asyncIterator]();
  return new Response(
    new ReadableStream({
      async pull(controller) {
        try {
          const next = await text.next();
          if (next.done) controller.close();
          else controller.enqueue(encoder.encode(next.value));
        } catch {
          controller.error(new Error("ai_failed"));
        }
      },
      cancel: () => void text.return?.(),
    }),
    { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } },
  );
}
