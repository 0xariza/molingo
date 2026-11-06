import { describe, expect, it } from "vitest";
import { planSessions, stationRanges } from "../plan";

const st = (id: string, plannedSessions: number, included = true) => ({
  id,
  plannedSessions,
  included,
});
const ses = (n: number, held: Record<number, string> = {}) =>
  Array.from({ length: n }, (_, i) => ({
    id: `s${i + 1}`,
    held: i + 1 in held,
    pathStationId: held[i + 1] ?? null,
  }));

describe("planSessions", () => {
  it("fills stations in order and leaves the rest for the next course", () => {
    const plan = planSessions([st("a", 3), st("b", 2), st("c", 3)], ses(6));
    expect([...plan.values()]).toEqual(["a", "a", "a", "b", "b", "c"]);
  });

  it("skips stations the class doesn't take", () => {
    const plan = planSessions([st("a", 2, false), st("b", 2)], ses(3));
    expect([...plan.values()]).toEqual(["b", "b", null]);
  });

  it("keeps held sessions and reflows the rest", () => {
    // a had 3 held sessions; b now gets 3 instead of 2, so c starts one session later.
    const plan = planSessions(
      [st("a", 3), st("b", 3), st("c", 2)],
      ses(8, { 1: "a", 2: "a", 3: "a" }),
    );
    expect([...plan.values()]).toEqual(["a", "a", "a", "b", "b", "b", "c", "c"]);
  });

  it("gives a station only what it still needs after its held sessions", () => {
    const plan = planSessions([st("a", 3), st("b", 2)], ses(4, { 1: "a", 2: "a" }));
    expect([...plan.values()]).toEqual(["a", "a", "a", "b"]);
  });

  it("numbers each station's sessions across the class", () => {
    const stations = [st("a", 2), st("b", 1, false), st("c", 3)];
    const plan = [...planSessions(stations, ses(4)).values()];
    expect(stationRanges(stations, plan)).toEqual([
      { id: "a", first: 1, last: 2, count: 2 },
      { id: "b", first: null, last: null, count: 0 },
      { id: "c", first: 3, last: 4, count: 2 },
    ]);
  });
});
