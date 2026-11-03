import { createHash } from "node:crypto";
import { AccessToken } from "livekit-server-sdk";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/livekit/webhook/route";
import { db } from "@/db";
import { attendanceEvents } from "@/db/schema";
import { createClass, createTeacher, createUser, resetDb } from "@/test/factories";

const secret = "secret-secret-secret-secret-secret";
beforeAll(() => {
  process.env.LIVEKIT_URL = "ws://localhost:7880";
  process.env.LIVEKIT_API_KEY = "devkey";
  process.env.LIVEKIT_API_SECRET = secret;
});
beforeEach(() => resetDb(db));

async function send(body: object, signed = true) {
  const raw = JSON.stringify(body);
  const token = new AccessToken("devkey", signed ? secret : "wrong-wrong-wrong-wrong-wrong-wrong");
  token.sha256 = createHash("sha256").update(raw).digest("base64");
  return POST(
    new Request("http://localhost/api/livekit/webhook", {
      method: "POST",
      headers: { authorization: await token.toJwt() },
      body: raw,
    }),
  );
}

describe("LiveKit webhook", () => {
  it("refuses an unsigned or wrongly signed event", async () => {
    expect((await send({ event: "participant_joined" }, false)).status).toBe(401);
    const bare = await POST(new Request("http://localhost/x", { method: "POST", body: "{}" }));
    expect(bare.status).toBe(401);
  });

  it("records joins of a class room and ignores other rooms", async () => {
    const mona = await createUser(db, { phone: "+989120000001", role: "teacher" });
    const sara = await createUser(db, { phone: "+989120000002", role: "student" });
    const cls = await createClass(db, {
      teacherId: (await createTeacher(db, mona.id)).id,
      slots: [{ weekday: 0, time: "08:00" }],
      startsOn: "2026-10-24",
      sessionCount: 1,
    });
    const event = (room: string, id: string) => ({
      event: "participant_joined",
      id,
      createdAt: 1_792_000_000,
      room: { name: room },
      participant: { identity: sara.id },
    });
    expect((await send(event(`s_${cls.sessions[0].id}`, "EV_1"))).status).toBe(200);
    expect((await send(event("l_some-level-check", "EV_2"))).status).toBe(200);
    const rows = await db.select().from(attendanceEvents);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: sara.id, event: "joined", livekitEventId: "EV_1" });
  });
});
