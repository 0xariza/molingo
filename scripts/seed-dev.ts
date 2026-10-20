/**
 * Local development data: Mona (admin) and Sara (learner), both with the password below, a few
 * learners without logins, demo classes in every state (seed-demo-classes.ts), open level-check
 * times over the next days with two bookings, and one moved session.
 * Refuses to run in production. Usage: pnpm db:seed
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

const DEV_PASSWORD = "dev-pass-2026";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("seed-dev must not run in production");
  const { db } = await import("../src/db");
  const { students, teachers, users } = await import("../src/db/schema");
  const { hashPassword } = await import("../src/server/auth/password");
  const { addSlot, assignSlot, bookLevelCheck, listOpenSlots } =
    await import("../src/server/funnel/level-check");
  const { teacherIdFor } = await import("../src/server/classes/classes");
  const { moveSession, sessionsBetween } = await import("../src/server/classes/sessions");
  const { eq } = await import("drizzle-orm");
  const { formatTime, fromTehranTime, tehranDateKey } = await import("../src/lib/format");
  const { parseClock } = await import("../src/lib/schedule");

  const passwordHash = await hashPassword(DEV_PASSWORD);
  const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  await db.transaction(async (tx) => {
    const [mona] = await tx
      .insert(users)
      .values({ phone: "+989120000001", role: "admin", displayName: "Mona", passwordHash })
      .onConflictDoNothing()
      .returning({ id: users.id });
    if (mona) await tx.insert(teachers).values({ userId: mona.id });

    const [sara] = await tx
      .insert(users)
      .values({ phone: "+989120000002", role: "student", displayName: "Sara", passwordHash })
      .onConflictDoNothing()
      .returning({ id: users.id });
    if (sara)
      await tx.insert(students).values({
        userId: sara.id,
        fullNameFa: "سارا احمدی",
        fullNameEn: "Sara Ahmadi",
        phone: "+989120000002",
        status: "active",
        startedAt: daysAgo(40),
      });

    // A few learners without logins, spread over recent months, for the learners page.
    await tx
      .insert(students)
      .values([
        {
          fullNameFa: "نیلوفر رحیمی",
          fullNameEn: "Niloofar Rahimi",
          phone: "+989121182040",
          status: "active",
          startedAt: daysAgo(10),
        },
        {
          fullNameFa: "آرش محمدی",
          fullNameEn: "Arash Mohammadi",
          phone: "+989194507781",
          status: "active",
          startedAt: daysAgo(75),
        },
        { fullNameFa: "مهسا جعفری", phone: "+989017723305", status: "lead" },
        {
          fullNameFa: "پریسا نوابی",
          fullNameEn: "Parisa Navabi",
          phone: "+989386019922",
          status: "paused",
          startedAt: daysAgo(120),
        },
      ])
      .onConflictDoNothing({ target: students.phone });
  });
  const { seedDemoClasses } = await import("./seed-demo-classes");
  await seedDemoClasses();

  const [monaUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.phone, "+989120000001"));
  const teacherId = await teacherIdFor(monaUser.id);
  // Times that are already there, past or clash with a class are skipped by addSlot.
  for (let day = 1; day <= 5; day++) {
    const date = tehranDateKey(new Date(Date.now() + day * 24 * 60 * 60 * 1000));
    for (const time of ["10:00", "17:30", "18:30"])
      await addSlot(fromTehranTime(date, time), teacherId);
  }
  // Two bookings on the calendar: one from the landing page, one Mona made herself.
  const [first, second] = await listOpenSlots();
  if (first)
    await bookLevelCheck({
      slotId: first.id,
      name: "نیکا رحیمی",
      phone: "+989125551234",
      levelGuess: "intermediate",
      locale: "fa",
    });
  if (second)
    await assignSlot({
      slotId: second.id,
      name: "سینا مرادی",
      phone: "+989352104417",
      locale: "fa",
    });
  // One upcoming session moved an hour later, so the calendar shows "moved".
  const soon = await sessionsBetween(
    teacherId,
    new Date(),
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  );
  const toMove = soon.find((s) => s.phase === "upcoming" && s.kind === "class" && !s.movedFrom);
  if (toMove) {
    const later = new Date(toMove.startsAt.getTime() + 60 * 60_000);
    await moveSession({
      sessionId: toMove.id,
      date: tehranDateKey(later),
      time: parseClock(formatTime(later, "en")) ?? 0,
    });
  }
  console.log("Dev accounts ready: 09120000001 (admin), 09120000002 (student).");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
