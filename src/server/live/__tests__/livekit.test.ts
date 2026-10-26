import { TokenVerifier } from "livekit-server-sdk";
import { beforeAll, describe, expect, it } from "vitest";
import { joinToken } from "../livekit";
import type { RoomInfo } from "../room";

beforeAll(() => {
  process.env.LIVEKIT_URL = "ws://localhost:7880";
  process.env.LIVEKIT_API_KEY = "devkey";
  process.env.LIVEKIT_API_SECRET = "secret-secret-secret-secret-secret";
});

const now = new Date("2026-10-24T04:40:00Z");
const info = (role: RoomInfo["role"]): RoomInfo => ({
  sessionId: "s1",
  classId: "c1",
  room: "s_s1",
  role,
  name: role === "teacher" ? "Mona" : "سارا",
  nameFa: "صبح A2",
  nameEn: null,
  level: "A2",
  kind: "class",
  capacity: 3,
  startsAt: now,
  endsAt: new Date(now.getTime() + 90 * 60_000),
  closesAt: new Date(now.getTime() + 90 * 60_000),
});

const verify = async (jwt: string) =>
  new TokenVerifier("devkey", "secret-secret-secret-secret-secret").verify(jwt);

describe("joinToken", () => {
  it("lets learners publish camera and microphone only, until the room closes", async () => {
    const claims = await verify(await joinToken("user-1", info("student"), now));
    expect(claims.sub).toBe("user-1");
    expect(claims.name).toBe("سارا");
    expect(claims.attributes).toEqual({ role: "student" });
    expect(claims.video).toMatchObject({
      room: "s_s1",
      roomJoin: true,
      canUpdateOwnMetadata: true,
      roomAdmin: false,
    });
    expect(claims.video?.canPublishSources).toEqual(["camera", "microphone"]);
    expect(claims.exp! - claims.nbf!).toBeGreaterThanOrEqual(90 * 60);
  });

  it("gives Mona screen sharing and moderation", async () => {
    const claims = await verify(await joinToken("user-2", info("teacher"), now));
    expect(claims.attributes).toEqual({ role: "teacher" });
    expect(claims.video?.roomAdmin).toBe(true);
    expect(claims.video?.canPublishSources).toContain("screen_share");
  });
});
