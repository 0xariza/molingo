import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { createTeacher, createUser, resetDb } from "@/test/factories";
import {
  addStationAfter,
  createSource,
  deleteStation,
  getSource,
  isStationComplete,
  listSources,
  mapState,
  moveStation,
  newSourceSchema,
  saveStation,
  stationSchema,
} from "../sources";

let tid: string;
let otherTid: string;
beforeEach(async () => {
  await resetDb(db);
  tid = (
    await createTeacher(db, (await createUser(db, { phone: "+989120000001", role: "teacher" })).id)
  ).id;
  otherTid = (
    await createTeacher(db, (await createUser(db, { phone: "+989120000002", role: "teacher" })).id)
  ).id;
});

const newSource = (o: Record<string, string> = {}) =>
  newSourceSchema.parse({
    title: "کتاب نمونه، جلد ۲",
    level: "A2",
    chapters: "۳",
    plannedSessions: "2",
    ...o,
  });
const station = (o: Record<string, unknown> = {}) =>
  stationSchema.parse({
    title: "از گذشته‌ام تعریف می‌کنم",
    sourceUnit: "فصل ۳",
    plannedSessions: "3",
    skills: ["a", "b", "c"],
    ...o,
  });

describe("schemas", () => {
  it("reads Persian digits and rejects out-of-range counts", () => {
    expect(newSource().chapters).toBe(3);
    expect(
      newSourceSchema.safeParse({ title: "x", level: "A2", chapters: "0", plannedSessions: "2" })
        .success,
    ).toBe(false);
    expect(
      newSourceSchema.safeParse({ title: "x", level: "A2", chapters: "3", plannedSessions: "0" })
        .success,
    ).toBe(false);
    expect(
      newSourceSchema.safeParse({ title: " ", level: "A2", chapters: "3", plannedSessions: "2" })
        .success,
    ).toBe(false);
  });
  it("drops empty skill lines and has no skill cap", () => {
    expect(station({ skills: ["a", " ", "b"] }).skills).toEqual(["a", "b"]);
    expect(
      stationSchema.safeParse({
        title: "",
        sourceUnit: "",
        plannedSessions: "2",
        skills: ["a", "b", "c", "d", "e"],
      }).success,
    ).toBe(true);
  });
});

describe("map state", () => {
  it("needs a title and one skill per station", () => {
    expect(isStationComplete({ title: "x", skillCount: 3 })).toBe(true);
    expect(isStationComplete({ title: "", skillCount: 4 })).toBe(false);
    expect(isStationComplete({ title: "x", skillCount: 0 })).toBe(false);
    expect(mapState([])).toEqual({ total: 0, done: 0, state: "empty" });
    expect(
      mapState([
        { title: "x", skillCount: 3 },
        { title: "", skillCount: 0 },
      ]).state,
    ).toBe("partial");
    expect(mapState([{ title: "x", skillCount: 3 }]).state).toBe("complete");
  });
});

describe("sources", () => {
  it("creates one empty station per chapter and lists the map as partial", async () => {
    const id = await createSource(newSource(), tid);
    const src = await getSource(tid, id);
    expect(src?.stations.map((s) => [s.position, s.plannedSessions, s.title])).toEqual([
      [1, 2, ""],
      [2, 2, ""],
      [3, 2, ""],
    ]);
    expect(await listSources(tid)).toEqual([
      expect.objectContaining({ id, total: 3, done: 0, state: "partial" }),
    ]);
  });

  it("saves a station with its skills and counts it complete", async () => {
    const id = await createSource(newSource({ chapters: "1" }), tid);
    const [s] = (await getSource(tid, id))!.stations;
    expect(await saveStation(tid, s.id, station())).toBe(true);
    const saved = (await getSource(tid, id))!.stations[0];
    expect(saved).toMatchObject({
      title: "از گذشته‌ام تعریف می‌کنم",
      sourceUnit: "فصل ۳",
      plannedSessions: 3,
      skills: ["a", "b", "c"],
    });
    expect((await listSources(tid))[0].state).toBe("complete");
    expect(await saveStation(tid, s.id, station({ skills: ["only"] }))).toBe(true);
    expect((await getSource(tid, id))!.stations[0].skills).toEqual(["only"]);
  });

  it("adds after, moves and deletes stations keeping positions gap-free", async () => {
    const id = await createSource(newSource(), tid);
    const [a, b, c] = (await getSource(tid, id))!.stations;
    const added = await addStationAfter(tid, a.id);
    const ids = async () => (await getSource(tid, id))!.stations.map((s) => s.id);
    expect(await ids()).toEqual([a.id, added, b.id, c.id]);
    expect(await moveStation(tid, c.id, -1)).toBe(true);
    expect(await ids()).toEqual([a.id, added, c.id, b.id]);
    expect(await moveStation(tid, a.id, -1)).toBe(false);
    expect(await deleteStation(tid, added!)).toBe("ok");
    const after = (await getSource(tid, id))!.stations;
    expect(after.map((s) => [s.id, s.position])).toEqual([
      [a.id, 1],
      [c.id, 2],
      [b.id, 3],
    ]);
  });

  it("keeps the last station", async () => {
    const id = await createSource(newSource({ chapters: "1" }), tid);
    const [s] = (await getSource(tid, id))!.stations;
    expect(await deleteStation(tid, s.id)).toBe("lastStation");
  });

  it("hides another teacher's source and refuses edits to it", async () => {
    const id = await createSource(newSource(), tid);
    const [s] = (await getSource(tid, id))!.stations;
    expect(await getSource(otherTid, id)).toBeNull();
    expect(await listSources(otherTid)).toEqual([]);
    expect(await saveStation(otherTid, s.id, station())).toBe(false);
    expect(await addStationAfter(otherTid, s.id)).toBeNull();
    expect(await moveStation(otherTid, s.id, 1)).toBe(false);
    expect(await deleteStation(otherTid, s.id)).toBe("notFound");
  });
});
