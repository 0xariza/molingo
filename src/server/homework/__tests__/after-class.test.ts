import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { asc, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { assignments, sessions, students, teacherLearners } from "@/db/schema";
import { fromTehranTime } from "@/lib/format";
import { createTeacher, createUser, resetDb } from "@/test/factories";
import { createClass, enroll, newClassSchema } from "@/server/classes/classes";
import { markHeld } from "@/server/classes/sessions";
import { saveClassPath } from "@/server/paths/class-paths";
import { getStationCheck, learnerPaths, saveStationCheck } from "@/server/paths/station-check";
import {
  createSource,
  getSource,
  newSourceSchema,
  saveStation,
  stationSchema,
} from "@/server/paths/sources";
import { coveredSchema, getAfterClass, saveCovered } from "../after-class";
import { assignmentSchema, saveAssignment } from "../assignments";

beforeAll(async () => {
  process.env.UPLOAD_DIR = await mkdtemp(join(tmpdir(), "hoopo-uploads-"));
});

const now = fromTehranTime("2026-10-14", "12:00");
const after = fromTehranTime("2026-10-24", "10:00");
let teacher: { teacherId: string; userId: string };

beforeEach(async () => {
  await resetDb(db);
  const user = await createUser(db, { phone: "+989120000001", role: "teacher" });
  teacher = { teacherId: (await createTeacher(db, user.id)).id, userId: user.id };
});

/** A 4-session class on a two-station path (2 + 2), its first session held by Sara. */
async function setup({ withPath = true } = {}) {
  const made = await createClass(
    newClassSchema.parse({
      nameFa: "صبح A2",
      nameEn: "",
      level: "A2",
      type: "private",
      capacity: "1",
      sessionCount: "4",
      sessionMinutes: "90",
      slots: JSON.stringify([{ weekday: 0, time: "08:00" }]),
      startsOn: "2026-10-24",
      price: "650000",
      description: "",
      isPublic: false,
      studentIds: "[]",
    }),
    teacher.teacherId,
    now,
  );
  if (!made.ok) throw new Error(made.error);
  if (withPath) {
    const sourceId = await createSource(
      newSourceSchema.parse({ title: "Book", level: "A2", chapters: "2", plannedSessions: "2" }),
      teacher.teacherId,
    );
    const list = (await getSource(teacher.teacherId, sourceId))!.stations;
    for (const [i, s] of list.entries())
      await saveStation(
        teacher.teacherId,
        s.id,
        stationSchema.parse({
          title: `Station ${i + 1}`,
          sourceUnit: "",
          plannedSessions: "2",
          skills: ["tells a story", "says what they did", "says what they didn't do"],
        }),
      );
    await saveClassPath(teacher.teacherId, made.id, {
      sourceId,
      items: list.map((s) => ({
        kind: "source",
        stationId: s.id,
        included: true,
        plannedSessions: 2,
      })),
    });
  }
  const user = await createUser(db, { phone: "+989130000001" });
  const [sara] = await db
    .insert(students)
    .values({ userId: user.id, fullNameFa: "سارا", phone: user.phone })
    .returning({ id: students.id });
  await db
    .insert(teacherLearners)
    .values({ teacherId: teacher.teacherId, studentId: sara.id, status: "active" });
  await enroll(teacher.teacherId, made.id, sara.id);
  const [first] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.classId, made.id))
    .orderBy(asc(sessions.startsAt));
  await markHeld(teacher.teacherId, first.id, { [sara.id]: "present" }, after);
  return { classId: made.id, sessionId: first.id, saraId: sara.id };
}

describe("after class", () => {
  it("shows the session's station with its skills, and only for a held session", async () => {
    const { sessionId } = await setup();
    const page = (await getAfterClass(teacher.teacherId, sessionId, after))!;
    expect(page).toMatchObject({ number: 1, sessionCount: 4, present: 1, homework: [] });
    expect(page.station).toMatchObject({
      title: "Station 1",
      position: 1,
      sessionInStation: 1,
      of: 2,
    });
    expect(page.station!.skills.map((k) => k.worked)).toEqual([false, false, false]);

    const [upcoming] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.status, "scheduled"))
      .limit(1);
    expect(await getAfterClass(teacher.teacherId, upcoming.id, after)).toBeNull();
  });

  it("saves topics, summary and the skills worked on (only the station's own)", async () => {
    const { sessionId } = await setup();
    const { station } = (await getAfterClass(teacher.teacherId, sessionId, after))!;
    const [first, second] = station!.skills;
    const saved = await saveCovered(
      teacher.teacherId,
      coveredSchema.parse({
        sessionId,
        topics: ["Past simple", " didn't ", "Past simple"],
        summary: "Weekend stories.",
        privateNote: "",
        skillIds: [first.id, second.id, crypto.randomUUID()],
      }),
    );
    expect(saved).toBe(true);
    const page = (await getAfterClass(teacher.teacherId, sessionId, after))!;
    expect(page.topics).toEqual(["Past simple", "didn't"]);
    expect(page.summary).toBe("Weekend stories.");
    expect(page.privateNote).toBeNull();
    expect(page.station!.skills.map((k) => k.worked)).toEqual([true, true, false]);
  });

  it("lists the session's homework with its type, skill and recipients", async () => {
    const { sessionId, saraId } = await setup();
    const { station } = (await getAfterClass(teacher.teacherId, sessionId, after))!;
    const made = await saveAssignment(
      teacher,
      assignmentSchema.parse({
        sessionId,
        type: "speaking",
        title: "Tell me about your weekend",
        body: "",
        dueDate: "",
        dueTime: "",
        studentIds: [],
        stationSkillId: station!.skills[1].id,
        keep: [],
      }),
      [],
    );
    expect(made.ok).toBe(true);
    const page = (await getAfterClass(teacher.teacherId, sessionId, after))!;
    expect(page.homework).toMatchObject([
      {
        type: "speaking",
        title: "Tell me about your weekend",
        skillId: station!.skills[1].id,
        recipientIds: [saraId],
        all: true,
        handedIn: 0,
      },
    ]);
  });

  it("works without a path", async () => {
    const { sessionId } = await setup({ withPath: false });
    expect((await getAfterClass(teacher.teacherId, sessionId, after))!.station).toBeNull();
  });
});

describe("station check", () => {
  async function holdSecond(classId: string, saraId: string) {
    const [, second] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.classId, classId))
      .orderBy(asc(sessions.startsAt));
    await markHeld(
      teacher.teacherId,
      second.id,
      { [saraId]: "present" },
      fromTehranTime("2026-10-31", "10:00"),
    );
    return second.id;
  }

  it("only the station's last session has a check", async () => {
    const { classId, sessionId, saraId } = await setup();
    expect(await getStationCheck(teacher.teacherId, sessionId)).toBeNull();
    const last = await holdSecond(classId, saraId);
    expect(await getStationCheck(teacher.teacherId, last)).toMatchObject({ canHold: true });
    expect(
      await saveStationCheck(teacher.teacherId, { sessionId, results: [], action: "close" }),
    ).toEqual({ ok: false, error: "not_last" });
  });

  it("closing marks results and the station done; holding adds a session", async () => {
    const { classId, saraId } = await setup();
    const last = await holdSecond(classId, saraId);
    const check = (await getStationCheck(teacher.teacherId, last))!;
    const [a, b] = check.skills;
    const results = [
      { studentId: saraId, skillId: a.id, result: "ready" as const },
      { studentId: saraId, skillId: b.id, result: "again" as const },
    ];
    expect(
      await saveStationCheck(teacher.teacherId, { sessionId: last, results, action: "hold" }),
    ).toEqual({ ok: true });
    expect((await getStationCheck(teacher.teacherId, last)) ?? null).toBeNull(); // a later session joined the station
    const user = (await db.select().from(students).where(eq(students.id, saraId)))[0].userId!;
    const [path] = await learnerPaths(user);
    expect(path.stations[0].skills.map((k) => k.result)).toEqual(["ready", "again", null]);
    expect(path.stations.map((s) => s.state)).toEqual(["current", "next"]);
  });

  it('an "again" makes one open reinforcement; reviewing it makes the skill ready', async () => {
    const { classId, saraId } = await setup();
    const last = await holdSecond(classId, saraId);
    const [a] = (await getStationCheck(teacher.teacherId, last))!.skills;
    const again = [{ studentId: saraId, skillId: a.id, result: "again" as const }];
    await saveStationCheck(teacher.teacherId, { sessionId: last, results: again, action: "hold" });
    await saveStationCheck(teacher.teacherId, { sessionId: last, results: again, action: "hold" });
    const made = await db.select().from(assignments).where(eq(assignments.reinforcement, true));
    expect(made).toHaveLength(1); // not a second while the first is open
    expect(made[0]).toMatchObject({ title: a.text, stationSkillId: a.id });
  });
});
