import type { HomeworkType } from "./types";

/** What stops a homework item from being sent; a draft may still have it. */
export type HomeworkIssue = "no_audio" | "no_text" | "no_body";

const isAudio = (mime: string) => mime.split(";")[0].trim().toLowerCase().startsWith("audio/");

/** Listening needs audio; reading needs a file or a real text; every item needs a description. */
export function homeworkIssue(
  type: HomeworkType,
  body: string | null,
  mimes: string[],
): HomeworkIssue | null {
  if (type === "listening" && !mimes.some(isAudio)) return "no_audio";
  if (type === "reading" && !mimes.length && (body?.trim().length ?? 0) < 40) return "no_text";
  if (!body?.trim()) return "no_body";
  return null;
}
