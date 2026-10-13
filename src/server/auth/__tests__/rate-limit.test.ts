import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { resetDb } from "@/test/factories";
import { consumeRateLimit, resetRateLimit } from "../rate-limit";

beforeEach(() => resetDb(db));

describe("consumeRateLimit", () => {
  it("counts within a window and reports retry time", async () => {
    const a = await consumeRateLimit("k", 2, 60);
    const b = await consumeRateLimit("k", 2, 60);
    const c = await consumeRateLimit("k", 2, 60);
    expect([a.allowed, b.allowed, c.allowed]).toEqual([true, true, false]);
    expect(c.retryAfterSec).toBeGreaterThan(0);
    expect(c.retryAfterSec).toBeLessThanOrEqual(60);
  });

  it("keeps keys independent and can be reset", async () => {
    await consumeRateLimit("a", 1, 60);
    expect((await consumeRateLimit("b", 1, 60)).allowed).toBe(true);
    expect((await consumeRateLimit("a", 1, 60)).allowed).toBe(false);
    await resetRateLimit("a");
    expect((await consumeRateLimit("a", 1, 60)).allowed).toBe(true);
  });
});
