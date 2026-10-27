/**
 * Dev-only demo classes covering every state the class pages show, timed around "now":
 * a running group (held sessions with absent/excused, a cancelled one with a make-up, one waiting
 * to be confirmed), a session that is live right now, an upcoming public group (landing page), a
 * full class, a finished class (next course unlocked), a private class and an archived one.
 * Called from seed-dev.ts; skipped when the demo classes already exist.
 */
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../src/db";
import {
  attendance,
  classes,
  classSlots,
  enrollments,
  sessionParticipants,
  sessions,
  students,
  teacherLearners,
  teachers,
  users,
} from "../src/db/schema";
import { fromTehranTime, tehranDateKey } from "../src/lib/format";
import { addDays, formatClock, nextDateOn, sessionTimes, type Weekday } from "../src/lib/schedule";
import { isOverlapError } from "../src/server/classes/clash";

const DAY = 24 * 60 * 60 * 1000;

type Demo = {
  nameFa: string;
  nameEn: string;
  level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  type: "private" | "group";
  capacity: number;
  slots: { weekday: Weekday; minutes: number }[];
  sessionCount: number;
  minutes: number;
  /** Days from today to (about) the first session; negative = already running. */
  startInDays: number;
  price: number;
  learners: string[];
  isPublic?: boolean;
  archived?: boolean;
  /** Leave the most recent ended session unconfirmed ("needs confirming"). */
  leaveLastOpen?: boolean;
  /** 0-based session index Mona cancelled. */
  cancelIndex?: number;
};

const EXTRA_LEARNERS = [
  { fullNameFa: "ندا کریمی", fullNameEn: "Neda Karimi", phone: "+989121230001" },
  { fullNameFa: "کیان حسینی", fullNameEn: "Kian Hosseini", phone: "+989352104417" },
  { fullNameFa: "امید رضایی", fullNameEn: "Omid Rezaei", phone: "+989121230003" },
  { fullNameFa: "شیرین توکلی", fullNameEn: "Shirin Tavakoli", phone: "+989121230004" },
  { fullNameFa: "بابک احمدی", fullNameEn: "Babak Ahmadi", phone: "+989121230005" },
];

export async function seedDemoClasses(now = new Date()) {
  const [mona] = await db
    .select({ teacherId: teachers.id })
    .from(teachers)
    .innerJoin(users, eq(users.id, teachers.userId))
    .where(eq(users.phone, "+989120000001"));
  if (!mona) return console.log("No teacher record for Mona; skipped demo classes.");
  const [already] = await db
    .select({ id: classes.id })
    .from(classes)
    .where(eq(classes.nameFa, "مکالمه B1"));
  if (already) return console.log("Demo classes already there.");

  await db.insert(students).values(EXTRA_LEARNERS).onConflictDoNothing({ target: students.phone });
  const byPhone = new Map(
    (await db.select({ id: students.id, phone: students.phone }).from(students)).map((s) => [
      s.phone,
      s.id,
    ]),
  );
  // Every demo learner is one of Mona's.
  await db
    .insert(teacherLearners)
    .values(
      EXTRA_LEARNERS.map((l) => ({
        teacherId: mona.teacherId,
        studentId: byPhone.get(l.phone)!,
        status: "active" as const,
        startedAt: new Date(now.getTime() - 30 * DAY),
      })),
    )
    .onConflictDoNothing();
  const id = (phone: string) => byPhone.get(phone)!;
  const [niloofar, arash, sara, parisa] = [
    "+989121182040",
    "+989194507781",
    "+989120000002",
    "+989386019922",
  ];
  const [neda, kian, omid, shirin, babak] = EXTRA_LEARNERS.map((l) => l.phone);

  const today = tehranDateKey(now);
  const demos: Demo[] = [
    {
      nameFa: "صبح‌های A2",
      nameEn: "Morning A2",
      level: "A2",
      type: "group",
      capacity: 3,
      slots: [
        { weekday: 0, minutes: 10 * 60 + 30 },
        { weekday: 2, minutes: 10 * 60 + 30 },
      ],
      sessionCount: 12,
      minutes: 90,
      startInDays: -26,
      price: 6_500_000,
      learners: [niloofar, arash, neda],
      leaveLastOpen: true,
      cancelIndex: 2,
    },
    {
      nameFa: "مکالمه B1",
      nameEn: "Speaking B1",
      level: "B1",
      type: "group",
      capacity: 3,
      slots: [{ weekday: 4, minutes: 12 * 60 }],
      sessionCount: 8,
      minutes: 60,
      startInDays: -15,
      price: 4_800_000,
      learners: [kian, omid],
      isPublic: true,
    },
    {
      nameFa: "آیلتس B2",
      nameEn: "IELTS B2",
      level: "B2",
      type: "group",
      capacity: 4,
      slots: [
        { weekday: 1, minutes: 19 * 60 },
        { weekday: 3, minutes: 19 * 60 },
      ],
      sessionCount: 10,
      minutes: 90,
      startInDays: 3,
      price: 9_000_000,
      learners: [shirin, babak],
      isPublic: true,
    },
    {
      nameFa: "گفت‌وگوی C1",
      nameEn: "Conversation C1",
      level: "C1",
      type: "group",
      capacity: 2,
      slots: [{ weekday: 5, minutes: 10 * 60 }],
      sessionCount: 8,
      minutes: 60,
      startInDays: -8,
      price: 5_200_000,
      learners: [kian, shirin],
    },
    {
      nameFa: "کودکان A1",
      nameEn: "Kids A1",
      level: "A1",
      type: "group",
      capacity: 3,
      slots: [
        { weekday: 1, minutes: 16 * 60 },
        { weekday: 3, minutes: 16 * 60 },
      ],
      sessionCount: 8,
      minutes: 60,
      startInDays: -40,
      price: 4_000_000,
      learners: [arash, omid],
    },
    {
      nameFa: "خصوصی سارا",
      nameEn: "Sara · private",
      level: "B1",
      type: "private",
      capacity: 1,
      slots: [{ weekday: 4, minutes: 17 * 60 }],
      sessionCount: 10,
      minutes: 60,
      startInDays: -22,
      price: 800_000,
      learners: [sara],
    },
    {
      nameFa: "عصرهای B1 (قدیمی)",
      nameEn: "Evening B1 (old)",
      level: "B1",
      type: "group",
      capacity: 3,
      slots: [{ weekday: 6, minutes: 18 * 60 }],
      sessionCount: 6,
      minutes: 60,
      startInDays: -80,
      price: 3_500_000,
      learners: [parisa],
      archived: true,
    },
  ];

  for (const d of demos) {
    const weekdays = d.slots.map((s) => s.weekday);
    const startsOn = nextDateOn(addDays(today, d.startInDays - 1), weekdays);
    const [cls] = await db
      .insert(classes)
      .values({
        teacherId: mona.teacherId,
        nameFa: d.nameFa,
        nameEn: d.nameEn,
        level: d.level,
        type: d.type,
        capacity: d.capacity,
        sessionCount: d.sessionCount,
        sessionMinutes: d.minutes,
        startsOn,
        priceToman: d.price,
        isPublic: !!d.isPublic,
        archivedAt: d.archived ? now : null,
      })
      .returning({ id: classes.id });
    await db.insert(classSlots).values(
      d.slots.map((s) => ({
        classId: cls.id,
        weekday: s.weekday,
        startTime: formatClock(s.minutes),
      })),
    );
    const learnerIds = d.learners.map(id);
    const ended = d.archived;
    await db.insert(enrollments).values(
      learnerIds.map((studentId) => ({
        classId: cls.id,
        studentId,
        startedAt: fromTehranTime(startsOn, "00:00"),
        status: ended ? ("ended" as const) : ("active" as const),
        endedAt: ended ? now : null,
      })),
    );

    const times = sessionTimes({
      startsOn,
      slots: d.slots,
      count: d.sessionCount,
      sessionMinutes: d.minutes,
    });
    const lastEnded = times.filter((t) => t.endsAt <= now).length - 1;
    for (const [i, t] of times.entries()) {
      const past = t.endsAt <= now;
      const cancelled = i === d.cancelIndex;
      const held = past && !cancelled && !(d.leaveLastOpen && i === lastEnded);
      const row = await tryInsert({
        teacherId: mona.teacherId,
        classId: cls.id,
        ...t,
        status: cancelled ? "cancelled" : held ? "held" : "scheduled",
        cancelReason: cancelled ? "مریض بودم" : null,
        heldAt: held ? t.endsAt : null,
      });
      if (row && held) {
        await db.insert(attendance).values(
          learnerIds.map((studentId, j) => ({
            sessionId: row,
            studentId,
            // Mostly present; a few absences (charged) and excused ones (not charged).
            status:
              i === 1 && j === 1
                ? ("absent" as const)
                : i === 3 && j === 0
                  ? ("excused" as const)
                  : ("present" as const),
          })),
        );
      }
      if (row && cancelled) {
        // Mona added a make-up for the cancelled session, three days from now, for the first learner.
        const at = fromTehranTime(addDays(today, 3), "15:00");
        const makeup = await tryInsert({
          teacherId: mona.teacherId,
          classId: cls.id,
          kind: "makeup",
          startsAt: at,
          endsAt: new Date(at.getTime() + d.minutes * 60_000),
          replacesSessionId: row,
        });
        if (makeup)
          await db
            .insert(sessionParticipants)
            .values({ sessionId: makeup, studentId: learnerIds[0] });
      }
    }
    if (d.nameFa === "مکالمه B1") {
      // A make-up that started 20 minutes ago: the class page shows "on now".
      const start = new Date(Math.floor((now.getTime() - 20 * 60_000) / 300_000) * 300_000);
      const live = await tryInsert({
        teacherId: mona.teacherId,
        classId: cls.id,
        kind: "makeup",
        startsAt: start,
        endsAt: new Date(start.getTime() + 60 * 60_000),
      });
      if (live)
        await db
          .insert(sessionParticipants)
          .values(learnerIds.map((studentId) => ({ sessionId: live, studentId })));
    }
  }

  // Learners in running classes are active.
  await db
    .update(teacherLearners)
    .set({ status: "active" })
    .where(
      and(
        eq(teacherLearners.teacherId, mona.teacherId),
        inArray(teacherLearners.studentId, [id(neda), id(kian), id(omid), id(shirin), id(babak)]),
        eq(teacherLearners.status, "lead"),
      ),
    );
  console.log(`Demo classes ready: ${demos.length} classes.`);
}

/** Inserts a session; one that would overlap another of Mona's sessions is skipped. */
async function tryInsert(values: typeof sessions.$inferInsert): Promise<string | null> {
  try {
    const [row] = await db.insert(sessions).values(values).returning({ id: sessions.id });
    return row.id;
  } catch (e) {
    if (isOverlapError(e)) return null;
    throw e;
  }
}
