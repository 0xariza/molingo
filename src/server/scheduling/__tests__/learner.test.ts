import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { sessions, students, teacherLearners } from "@/db/schema";
import { fromTehranTime } from "@/lib/format";
import { createTeacher, createUser, resetDb } from "@/test/factories";
import { createClass, endEnrollment, enroll, newClassSchema } from "../../classes/classes";
import { addMakeup, cancelSession, makeupSchema } from "../../classes/sessions";
import { learnerSchedule } from "../learner";

beforeEach(() => resetDb(db));

const at = (date: string, time: string) => fromTehranTime(date, time);
const now = at("2026-10-14", "12:00");

async function setup() {
  const mona = await createUser(db, { phone: "+989120000001", role: "teacher" });
  const teacherId = (await createTeacher(db, mona.id)).id;
  const sara = await createUser(db, { phone: "+989120000002", role: "student" });
  const [mine, other] = await db
    .insert(students)
    .values([
      { fullNameFa: "سارا", phone: "+989120000002", userId: sara.id },
      { fullNameFa: "نیما", phone: "+989120000003" },
    ])
    .returning({ id: students.id });
  await db
    .insert(teacherLearners)
    .values([mine, other].map((l) => ({ teacherId, studentId: l.id, status: "active" as const })));
  // Sat/Mon 10:30 from Sat 17 Oct, 6 × 90 min: three sessions fall in the next two weeks.
  const r = await createClass(
    newClassSchema.parse({
      nameFa: "صبح A2",
      nameEn: "",
      level: "A2",
      type: "group",
      capacity: "3",
      sessionCount: "6",
      sessionMinutes: "90",
      slots: JSON.stringify([
        { weekday: 0, time: "10:30" },
        { weekday: 2, time: "10:30" },
      ]),
      startsOn: "2026-10-17",
      price: "6500000",
      description: "",
      isPublic: false,
      studentIds: "[]",
    }),
    teacherId,
    now,
  );
  if (!r.ok) throw new Error(r.error);
  await enroll(teacherId, r.id, mine.id);
  await enroll(teacherId, r.id, other.id);
  return { classId: r.id, teacherId, userId: sara.id, mine: mine.id, other: other.id };
}

describe("learnerSchedule", () => {
  it("lists the next two weeks of the learner's sessions, numbered, cancelled ones included", async () => {
    const { classId, teacherId, userId } = await setup();
    const list = await db.select().from(sessions).where(eq(sessions.classId, classId));
    const second = list.find((s) => s.startsAt.getTime() === at("2026-10-19", "10:30").getTime())!;
    await cancelSession(teacherId, second.id, "بیمار هستم", now);

    const mine = await learnerSchedule(userId, now);
    expect(mine.map((s) => [s.startsAt, s.number, s.phase, s.cancelReason])).toEqual([
      [at("2026-10-17", "10:30"), 1, "upcoming", null],
      [at("2026-10-19", "10:30"), 2, "cancelled", "بیمار هستم"],
      [at("2026-10-24", "10:30"), 3, "upcoming", null],
      [at("2026-10-26", "10:30"), 4, "upcoming", null],
    ]);
    expect(mine[0]).toMatchObject({ nameFa: "صبح A2", sessionCount: 6, kind: "class" });
  });

  it("shows make-ups only to the learners invited, and nothing after the place ends", async () => {
    const { classId, teacherId, userId, mine, other } = await setup();
    await addMakeup(
      teacherId,
      makeupSchema.parse({
        classId,
        date: "2026-10-20",
        time: "15:00",
        minutes: "90",
        studentIds: [other],
      }),
      now,
    );
    expect((await learnerSchedule(userId, now)).some((s) => s.kind === "makeup")).toBe(false);

    await addMakeup(
      teacherId,
      makeupSchema.parse({
        classId,
        date: "2026-10-21",
        time: "15:00",
        minutes: "90",
        studentIds: [mine],
      }),
      now,
    );
    expect((await learnerSchedule(userId, now)).filter((s) => s.kind === "makeup")).toMatchObject([
      { number: null, startsAt: at("2026-10-21", "15:00") },
    ]);

    await endEnrollment(teacherId, classId, mine);
    expect((await learnerSchedule(userId, now)).every((s) => s.kind === "makeup")).toBe(true);
  });
});
