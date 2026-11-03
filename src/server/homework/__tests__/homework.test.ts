import { existsSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { files, sessions, students, teacherLearners } from "@/db/schema";
import { fromTehranTime } from "@/lib/format";
import { createTeacher, createUser, resetDb } from "@/test/factories";
import { createClass, endEnrollment, enroll, newClassSchema } from "@/server/classes/classes";
import { markHeld } from "@/server/classes/sessions";
import { readableFile } from "../access";
import {
  assignmentSchema,
  assignTargets,
  createAssignment,
  deleteAssignment,
  homeworkOverview,
} from "../assignments";
import {
  getReview,
  learnerAssignment,
  learnerHomework,
  reviewQueue,
  reviewSubmission,
  submitAnswer,
  toReviewCount,
} from "../submissions";

beforeAll(async () => {
  process.env.UPLOAD_DIR = await mkdtemp(join(tmpdir(), "hoopo-uploads-"));
});

const now = fromTehranTime("2026-10-14", "12:00");
const after = fromTehranTime("2026-10-24", "10:00");
const pdf = (name = "notes.pdf") => new File(["%PDF"], name, { type: "application/pdf" });
const input = (sessionId: string, extra: object = {}) =>
  assignmentSchema.parse({
    sessionId,
    title: "Weekend",
    body: "",
    dueDate: "",
    dueTime: "",
    ...extra,
  });

let teacher: { teacherId: string; userId: string };
let n = 0;

/** A learner with a login, linked to the teacher. */
async function learner(teacherId = teacher.teacherId) {
  const user = await createUser(db, { phone: `+98913000${String(++n).padStart(4, "0")}` });
  const [row] = await db
    .insert(students)
    .values({ userId: user.id, fullNameFa: `زبان‌آموز ${n}`, phone: user.phone })
    .returning({ id: students.id });
  await db.insert(teacherLearners).values({ teacherId, studentId: row.id, status: "active" });
  return { userId: user.id, studentId: row.id };
}

beforeEach(async () => {
  await resetDb(db);
  const user = await createUser(db, { phone: "+989120000001", role: "teacher" });
  teacher = { teacherId: (await createTeacher(db, user.id)).id, userId: user.id };
});

/** A class whose first session is held; returns the held session and its two learners. */
async function heldClass() {
  const made = await createClass(
    newClassSchema.parse({
      nameFa: "صبح A2",
      nameEn: "Morning A2",
      level: "A2",
      type: "group",
      capacity: "3",
      sessionCount: "4",
      sessionMinutes: "90",
      slots: JSON.stringify([{ weekday: 0, time: "08:00" }]),
      startsOn: "2026-10-24",
      price: "6500000",
      description: "",
      isPublic: false,
      studentIds: "[]",
    }),
    teacher.teacherId,
    now,
  );
  if (!made.ok) throw new Error(made.error);
  const [a, b] = [await learner(), await learner()];
  await enroll(teacher.teacherId, made.id, a.studentId);
  await enroll(teacher.teacherId, made.id, b.studentId);
  const [first] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.classId, made.id))
    .orderBy(sessions.startsAt);
  const held = await markHeld(
    teacher.teacherId,
    first.id,
    { [a.studentId]: "present", [b.studentId]: "present" },
    after,
  );
  if (!held.ok) throw new Error(held.error);
  return { classId: made.id, sessionId: first.id, a, b };
}

describe("assignmentSchema", () => {
  it("needs a title, and a deadline date and time together", () => {
    expect(
      assignmentSchema.safeParse({
        sessionId: crypto.randomUUID(),
        title: " ",
        dueDate: "",
        dueTime: "",
      }).success,
    ).toBe(false);
    const half = {
      sessionId: crypto.randomUUID(),
      title: "x",
      body: "",
      dueDate: "2026-11-06",
      dueTime: "",
    };
    expect(assignmentSchema.safeParse(half).success).toBe(false);
    const full = assignmentSchema.parse({ ...half, dueTime: "20:00" });
    expect(full.dueAt).toEqual(fromTehranTime("2026-11-06", "20:00"));
  });
});

describe("createAssignment", () => {
  it("goes to the class's learners as they are now, not to those who join later", async () => {
    const { classId, sessionId, a, b } = await heldClass();
    const made = await createAssignment(teacher, input(sessionId), [pdf()]);
    expect(made.ok).toBe(true);
    const late = await learner();
    await enroll(teacher.teacherId, classId, late.studentId);

    expect((await learnerHomework(a.userId)).map((h) => h.title)).toEqual(["Weekend"]);
    expect(await learnerHomework(b.userId)).toHaveLength(1);
    expect(await learnerHomework(late.userId)).toEqual([]);
  });

  it("only for a held session of this teacher's, and a class with learners", async () => {
    const { sessionId } = await heldClass();
    const [upcoming] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.status, "scheduled"))
      .limit(1);
    expect(await createAssignment(teacher, input(upcoming.id), [])).toEqual({
      ok: false,
      error: "not_held",
    });

    const other = await createUser(db, { phone: "+989120000002", role: "teacher" });
    const stranger = { teacherId: (await createTeacher(db, other.id)).id, userId: other.id };
    expect(await createAssignment(stranger, input(sessionId), [])).toEqual({
      ok: false,
      error: "not_held",
    });
  });

  it("needs learners in the class", async () => {
    const { classId, sessionId, a, b } = await heldClass();
    await endEnrollment(teacher.teacherId, classId, a.studentId);
    await endEnrollment(teacher.teacherId, classId, b.studentId);
    expect(await createAssignment(teacher, input(sessionId), [])).toEqual({
      ok: false,
      error: "no_learners",
    });
  });

  it("refuses files of the wrong type, too big, or too many", async () => {
    const { sessionId } = await heldClass();
    const exe = new File(["x"], "a.exe", { type: "application/x-msdownload" });
    expect(await createAssignment(teacher, input(sessionId), [exe])).toEqual({
      ok: false,
      error: "file_type",
    });
    const huge = new File([new Uint8Array(15 * 1024 * 1024 + 1)], "a.pdf", {
      type: "application/pdf",
    });
    expect(await createAssignment(teacher, input(sessionId), [huge])).toEqual({
      ok: false,
      error: "file_size",
    });
    expect(
      await createAssignment(
        teacher,
        input(sessionId),
        Array.from({ length: 6 }, () => pdf()),
      ),
    ).toEqual({
      ok: false,
      error: "file_count",
    });
    expect(await db.select().from(files)).toEqual([]);
  });

  it("lists only classes with a held session as targets", async () => {
    expect(await assignTargets(teacher.teacherId, now)).toEqual([]);
    const { classId } = await heldClass();
    const [target] = await assignTargets(teacher.teacherId, now);
    expect(target).toMatchObject({ id: classId, learnerCount: 2 });
    expect(target.sessions.map((s) => s.number)).toEqual([1]);
    expect(target.nextStartsAt).not.toBeNull();
  });
});

describe("answers and review", () => {
  async function given() {
    const c = await heldClass();
    const made = await createAssignment(
      teacher,
      input(c.sessionId, { dueDate: "2026-10-26", dueTime: "20:00" }),
      [],
    );
    if (!made.ok) throw new Error(made.error);
    return { ...c, assignmentId: made.id };
  }
  const answer = (assignmentId: string, body: string, keep: string[] = []) => ({
    assignmentId,
    body,
    keep,
  });

  it("hand in, ask for a revision, hand in again, then it is locked once reviewed", async () => {
    const { a, assignmentId } = await given();
    expect(await submitAnswer(a.userId, answer(assignmentId, ""), [])).toEqual({
      ok: false,
      error: "empty",
    });

    const first = await submitAnswer(
      a.userId,
      answer(assignmentId, "I go"),
      [],
      fromTehranTime("2026-10-27", "09:00"),
    );
    expect(first).toEqual({ ok: true });
    const [queued] = await reviewQueue(teacher.teacherId, "submitted");
    expect(queued).toMatchObject({ revision: 1, late: true, hasText: true });
    expect(await toReviewCount(teacher.teacherId)).toBe(1);

    expect(
      await reviewSubmission(teacher.teacherId, {
        id: queued.id,
        decision: "needs_revision",
        feedback: "",
      }),
    ).toEqual({
      ok: false,
      error: "feedback_required",
    });
    await reviewSubmission(teacher.teacherId, {
      id: queued.id,
      decision: "needs_revision",
      feedback: "Use past",
    });
    expect((await learnerAssignment(a.userId, assignmentId))?.status).toBe("needs_revision");

    await submitAnswer(a.userId, answer(assignmentId, "I went"), []);
    const again = await learnerAssignment(a.userId, assignmentId);
    expect(again).toMatchObject({ status: "submitted", revision: 2, feedback: "Use past" });
    expect(again?.answer?.body).toBe("I went");

    await reviewSubmission(teacher.teacherId, {
      id: queued.id,
      decision: "reviewed",
      feedback: "Great",
    });
    expect(await submitAnswer(a.userId, answer(assignmentId, "again"), [])).toEqual({
      ok: false,
      error: "locked",
    });
    expect(await toReviewCount(teacher.teacherId)).toBe(0);
  });

  it("keeps chosen files, drops the rest, and caps an answer at five", async () => {
    const { a, assignmentId } = await given();
    await submitAnswer(a.userId, answer(assignmentId, "x"), [pdf("one.pdf"), pdf("two.pdf")]);
    const before = (await learnerAssignment(a.userId, assignmentId))!.answer!.files;
    const [keep, drop] = before;
    expect(await submitAnswer(a.userId, answer(assignmentId, "x", [keep.id]), [])).toEqual({
      ok: true,
    });
    const after = (await learnerAssignment(a.userId, assignmentId))!.answer!.files;
    expect(after.map((f) => f.id)).toEqual([keep.id]);
    expect(await db.select().from(files).where(eq(files.id, drop.id))).toEqual([]);
    expect(
      await submitAnswer(
        a.userId,
        answer(assignmentId, "x", [keep.id]),
        Array.from({ length: 5 }, () => pdf()),
      ),
    ).toEqual({ ok: false, error: "file_count" });
  });

  it("the queue runs oldest first, and reviewing returns the next one", async () => {
    const { a, b, assignmentId } = await given();
    await submitAnswer(
      a.userId,
      answer(assignmentId, "A"),
      [],
      fromTehranTime("2026-10-25", "10:00"),
    );
    await submitAnswer(
      b.userId,
      answer(assignmentId, "B"),
      [],
      fromTehranTime("2026-10-25", "11:00"),
    );
    const [first, second] = await reviewQueue(teacher.teacherId, "submitted");
    expect((await getReview(teacher.teacherId, first.id))?.queue).toMatchObject({
      position: 1,
      total: 2,
      previousId: null,
      nextId: second.id,
    });
    expect(
      await reviewSubmission(teacher.teacherId, {
        id: first.id,
        decision: "reviewed",
        feedback: "",
      }),
    ).toEqual({
      ok: true,
      nextId: second.id,
    });
    expect((await getReview(teacher.teacherId, first.id))?.queue).toBeNull();
  });

  it("another teacher can't read or review an answer", async () => {
    const { a, assignmentId } = await given();
    await submitAnswer(a.userId, answer(assignmentId, "A"), []);
    const [row] = await reviewQueue(teacher.teacherId, "submitted");
    const other = await createUser(db, { phone: "+989120000002", role: "teacher" });
    const stranger = await createTeacher(db, other.id);
    expect(await getReview(stranger.id, row.id)).toBeNull();
    expect(
      await reviewSubmission(stranger.id, { id: row.id, decision: "reviewed", feedback: "" }),
    ).toEqual({
      ok: false,
      error: "not_found",
    });
  });

  it("counts the overview", async () => {
    const { a, assignmentId } = await given();
    await submitAnswer(
      a.userId,
      answer(assignmentId, "A"),
      [],
      fromTehranTime("2026-10-25", "10:00"),
    );
    const stats = await homeworkOverview(teacher.teacherId, fromTehranTime("2026-10-25", "12:00"));
    expect(stats).toMatchObject({
      toReview: 1,
      dueThisWeek: 1,
      dueThisWeekIn: 1,
      dueThisWeekOf: 2,
      handInRate: 50,
    });
    expect(stats.open[0]).toMatchObject({
      title: "Weekend",
      recipients: 2,
      handedIn: 1,
      sessionNumber: 1,
    });
  });
});

describe("files and delete", () => {
  it("serves a file only to its teacher, its recipients and (answers) its author", async () => {
    const { sessionId, a, b } = await heldClass();
    const made = await createAssignment(teacher, input(sessionId), [pdf("task.pdf")]);
    if (!made.ok) throw new Error(made.error);
    await submitAnswer(a.userId, { assignmentId: made.id, body: "x", keep: [] }, [pdf("mine.pdf")]);
    const task = (await learnerAssignment(a.userId, made.id))!.files[0];
    const mine = (await learnerAssignment(a.userId, made.id))!.answer!.files[0];
    const outsider = (await learner()).userId;
    const other = await createUser(db, { phone: "+989120000002", role: "teacher" });
    await createTeacher(db, other.id);

    expect(await readableFile(teacher.userId, task.id)).not.toBeNull();
    expect(await readableFile(a.userId, task.id)).not.toBeNull();
    expect(await readableFile(b.userId, task.id)).not.toBeNull();
    expect(await readableFile(outsider, task.id)).toBeNull();
    expect(await readableFile(other.id, task.id)).toBeNull();

    expect(await readableFile(teacher.userId, mine.id)).not.toBeNull();
    expect(await readableFile(a.userId, mine.id)).not.toBeNull();
    expect(await readableFile(b.userId, mine.id)).toBeNull();
    expect(await readableFile(other.id, mine.id)).toBeNull();
  });

  it("deleting an assignment removes its answers and every file", async () => {
    const { sessionId, a } = await heldClass();
    const made = await createAssignment(teacher, input(sessionId), [pdf("task.pdf")]);
    if (!made.ok) throw new Error(made.error);
    await submitAnswer(a.userId, { assignmentId: made.id, body: "x", keep: [] }, [pdf("mine.pdf")]);
    const ids = (await db.select({ id: files.id }).from(files)).map((f) => f.id);
    expect(ids).toHaveLength(2);

    const other = await createUser(db, { phone: "+989120000002", role: "teacher" });
    const stranger = await createTeacher(db, other.id);
    expect(await deleteAssignment(stranger.id, made.id)).toBe(false);
    expect(await deleteAssignment(teacher.teacherId, made.id)).toBe(true);
    expect(await db.select().from(files)).toEqual([]);
    expect(await learnerHomework(a.userId)).toEqual([]);
    expect(ids.some((id) => existsSync(join(process.env.UPLOAD_DIR!, id)))).toBe(false);
  });
});
