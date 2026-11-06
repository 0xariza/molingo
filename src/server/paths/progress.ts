import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { students, studentSkills, voiceRecordings } from "@/db/schema";
import { checkUploads, storeFiles, type FileError } from "../files/storage";
import { learnerPaths } from "./station-check";

export const recordingSchema = z.object({ kind: z.enum(["before", "after"]) });

/** What the learner's progress page shows: counts from the path and their own recordings. */
export async function learnerProgress(userId: string) {
  const [me] = await db
    .select({ id: students.id })
    .from(students)
    .where(eq(students.userId, userId));
  if (!me) return null;
  const [paths, [skills], recordings] = await Promise.all([
    learnerPaths(userId),
    db
      .select({
        ready: sql<number>`count(*) filter (where ${studentSkills.result} = 'ready')::int`,
        again: sql<number>`count(*) filter (where ${studentSkills.result} = 'again')::int`,
      })
      .from(studentSkills)
      .where(eq(studentSkills.studentId, me.id)),
    db
      .select({
        id: voiceRecordings.id,
        kind: voiceRecordings.kind,
        fileId: voiceRecordings.fileId,
        createdAt: voiceRecordings.createdAt,
      })
      .from(voiceRecordings)
      .where(eq(voiceRecordings.studentId, me.id))
      .orderBy(desc(voiceRecordings.createdAt)),
  ]);
  const stations = paths.flatMap((p) => p.stations);
  return {
    stationsDone: stations.filter((s) => s.state === "done").length,
    stationsTotal: stations.length,
    ...skills,
    recordings,
  };
}

/** Saves one recording (an audio file) as the learner's "before" or "after". */
export async function saveRecording(
  userId: string,
  kind: "before" | "after",
  uploads: File[],
): Promise<{ ok: true } | { ok: false; error: FileError | "empty" | "not_audio" }> {
  const [file] = uploads;
  if (!file || uploads.length !== 1) return { ok: false, error: "empty" };
  if (!file.type.startsWith("audio/")) return { ok: false, error: "not_audio" };
  const bad = checkUploads(uploads);
  if (bad) return { ok: false, error: bad };
  const [me] = await db
    .select({ id: students.id })
    .from(students)
    .where(eq(students.userId, userId));
  if (!me) return { ok: false, error: "empty" };
  const [fileId] = await storeFiles(userId, uploads);
  await db.insert(voiceRecordings).values({ studentId: me.id, kind, fileId });
  return { ok: true };
}
