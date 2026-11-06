import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { createClass, createTeacher, createUser, resetDb } from "@/test/factories";
import { draftHomework, type Complete } from "../draft";

let teacherId: string;
let sessionId: string;
const ask = (request = "a short writing task") => ({ sessionId, request });

beforeEach(async () => {
  await resetDb(db);
  const user = await createUser(db, { phone: "+989120000001", role: "teacher" });
  teacherId = (await createTeacher(db, user.id)).id;
  const cls = await createClass(db, {
    teacherId,
    slots: [{ weekday: 0, time: "08:00" }],
    startsOn: "2026-10-24",
  });
  sessionId = cls.sessions[0].id;
  await db
    .update(sessions)
    .set({ status: "held", topics: "past simple" })
    .where(eq(sessions.id, sessionId));
});

const reply = (...parts: string[]) =>
  vi.fn<Complete>(async function* () {
    yield* parts;
  });
const collect = async (text: AsyncIterable<string>) => {
  let all = "";
  for await (const part of text) all += part;
  return all;
};

describe("draftHomework", () => {
  it("streams the model's text and gives it the level, topics and request", async () => {
    const complete = reply("Weekend\n\n", "Write 5 sentences.");
    const draft = await draftHomework(teacherId, ask(), complete);
    if (!draft.ok) throw new Error(draft.error);
    expect(await collect(draft.text)).toBe("Weekend\n\nWrite 5 sentences.");
    const [system, user] = complete.mock.calls[0];
    expect(system).toContain("title");
    expect(user).toContain("A2");
    expect(user).toContain("past simple");
    expect(user).toContain("a short writing task");
  });

  it("only drafts for the teacher's own held session", async () => {
    const other = await createUser(db, { phone: "+989120000002", role: "teacher" });
    const otherId = (await createTeacher(db, other.id)).id;
    const complete = reply("x");
    expect(await draftHomework(otherId, ask(), complete)).toEqual({ ok: false, error: "not_held" });
    expect(complete).not.toHaveBeenCalled();
  });

  it("stops after 30 drafts an hour", async () => {
    for (let i = 0; i < 30; i++)
      expect((await draftHomework(teacherId, ask(), reply("x"))).ok).toBe(true);
    expect(await draftHomework(teacherId, ask(), reply("x"))).toEqual({
      ok: false,
      error: "rate_limited",
    });
  });
});
