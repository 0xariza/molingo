import { and, eq } from "drizzle-orm";
import OpenAI from "openai";
import { z } from "zod";
import { db } from "@/db";
import { classes, sessions } from "@/db/schema";
import { consumeRateLimit } from "../rate-limit";
import { HOMEWORK_TYPES } from "./types";

export const draftSchema = z.object({
  sessionId: z.uuid(),
  type: z.enum(HOMEWORK_TYPES).optional(),
  request: z.string().trim().min(1, "request").max(500, "request"),
});

export type DraftError = "not_held" | "ai_failed" | "rate_limited";

/** One chat turn: system + user prompt in, the model's text out in pieces. Swapped in tests. */
export type Complete = (system: string, user: string) => AsyncIterable<string>;

const complete: Complete = async function* (system, user) {
  const client = new OpenAI({
    apiKey: process.env.GAP_GPT_API_KEY,
    baseURL: process.env.GAP_GPT_BASE_URL ?? "https://api.gapgpt.app/v1",
  });
  const stream = await client.chat.completions.create({
    model: process.env.GAP_GPT_MODEL ?? "gpt-6.1-sol",
    // "low" is the lowest this model accepts ("none" is rejected).
    reasoning_effort: "low",
    stream: true,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  for await (const chunk of stream) yield chunk.choices[0]?.delta.content ?? "";
};

/**
 * Starts a draft of one held session's homework from the teacher's description. The text streams
 * back as the title on the first line, a blank line, then the instructions.
 */
export async function draftHomework(
  teacherId: string,
  input: z.output<typeof draftSchema>,
  ask: Complete = complete,
): Promise<{ ok: true; text: AsyncIterable<string> } | { ok: false; error: DraftError }> {
  const [session] = await db
    .select({ topics: sessions.topics, level: classes.level })
    .from(sessions)
    .innerJoin(classes, eq(classes.id, sessions.classId))
    .where(
      and(
        eq(sessions.id, input.sessionId),
        eq(sessions.teacherId, teacherId),
        eq(sessions.status, "held"),
      ),
    );
  if (!session) return { ok: false, error: "not_held" };

  const limit = await consumeRateLimit(`hw-draft:${teacherId}`, 30, 60 * 60);
  if (!limit.allowed) return { ok: false, error: "rate_limited" };

  const system =
    "You write English homework for a language teacher's learners. Plain text only, no markdown: " +
    "the first line is the title (max 80 characters), then a blank line, then clear instructions " +
    "(max 1200 characters). Match the CEFR level. Do not mention scores or grading.";
  const user =
    `CEFR level: ${session.level}\n` +
    (input.type ? `Homework type: ${input.type}\n` : "") +
    (session.topics ? `Topics covered in the session: ${session.topics}\n` : "") +
    `The teacher wants: ${input.request}`;
  return { ok: true, text: ask(system, user) };
}
