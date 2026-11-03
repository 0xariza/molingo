import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { createClass, createTeacher, createUser, resetDb } from "@/test/factories";
import { minutesInRoom, recordRoomEvent, secondsInRoom, type RoomEvent } from "../attendance";

const t = (hhmm: string) => new Date(`2026-10-24T${hhmm}:00Z`);
const from = t("08:00");
const to = t("09:30");
const ev = (event: RoomEvent["event"], hhmm: string): RoomEvent => ({ event, at: t(hhmm) });

describe("secondsInRoom", () => {
  it("sums every visit so a reconnect adds up", () => {
    const events = [
      ev("joined", "08:00"),
      ev("left", "08:30"),
      ev("joined", "08:40"),
      ev("left", "09:10"),
    ];
    expect(secondsInRoom(events, from, to)).toBe(60 * 60);
  });

  it("counts a visit still open at the end until the end", () => {
    expect(secondsInRoom([ev("joined", "09:00")], from, to)).toBe(30 * 60);
  });

  it("ignores time outside the session and out-of-order or repeated events", () => {
    const events = [
      ev("left", "07:00"),
      ev("joined", "07:50"),
      ev("joined", "08:10"),
      ev("left", "08:20"),
      ev("left", "08:25"),
    ];
    // 07:50 is the first join (the repeat at 08:10 is ignored); the visit ends 08:20, clipped to 08:00.
    expect(secondsInRoom(events, from, to)).toBe(20 * 60);
  });
});

describe("room events in the database", () => {
  beforeEach(() => resetDb(db));

  it("stores a retried webhook once and sums minutes per person", async () => {
    const mona = await createUser(db, { phone: "+989120000001", role: "teacher" });
    const sara = await createUser(db, { phone: "+989120000002", role: "student" });
    const teacher = await createTeacher(db, mona.id);
    const cls = await createClass(db, {
      teacherId: teacher.id,
      slots: [{ weekday: 0, time: "08:00" }],
      startsOn: "2026-10-24",
      sessionCount: 1,
    });
    const session = cls.sessions[0];
    const base = { sessionId: session.id, userId: sara.id };
    await recordRoomEvent({
      ...base,
      event: "joined",
      at: session.startsAt,
      livekitEventId: "EV_1",
    });
    const left = {
      ...base,
      event: "left" as const,
      at: new Date(session.startsAt.getTime() + 45 * 60_000),
      livekitEventId: "EV_2",
    };
    await recordRoomEvent(left);
    await recordRoomEvent(left);
    expect((await minutesInRoom(session)).get(sara.id)).toBe(45);
  });
});
