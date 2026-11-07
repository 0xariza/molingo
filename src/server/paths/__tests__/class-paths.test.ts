import { and, asc, eq, inArray } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { sessions, stations } from "@/db/schema";
import { createClass, createTeacher, createUser, resetDb } from "@/test/factories";
import { cancelSession } from "../../classes/sessions";
import { getClassPath, pathSources, saveClassPath, type PathInput } from "../class-paths";
import { createSource, getSource, newSourceSchema, saveStation, stationSchema } from "../sources";

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

/** A complete A2 source with stations planned for 3, 2 and 3 sessions. */
async function source(teacherId = tid, plans = [3, 2, 3], level = "A2") {
  const id = await createSource(
    newSourceSchema.parse({
      title: "Book",
      level,
      chapters: String(plans.length),
      plannedSessions: "2",
    }),
    teacherId,
  );
  const list = (await getSource(teacherId, id))!.stations;
  for (const [i, s] of list.entries())
    await saveStation(
      teacherId,
      s.id,
      stationSchema.parse({
        title: `S${i + 1}`,
        sourceUnit: "",
        plannedSessions: String(plans[i]),
        skills: ["a", "b", "c"],
      }),
    );
  return { id, stations: list.map((s) => s.id) };
}

const klass = (teacherId = tid, sessionCount = 6) =>
  createClass(db, {
    teacherId,
    sessionCount,
    startsOn: "2026-11-21",
    slots: [{ weekday: 0, time: "18:00" }],
  });

const items = (
  ids: string[],
  plans: number[],
  included = ids.map(() => true),
): PathInput["items"] =>
  ids.map((stationId, i) => ({
    kind: "source",
    stationId,
    included: included[i],
    plannedSessions: plans[i],
  }));

async function sessionStations(classId: string) {
  const path = await getClassPath(tid, classId);
  const rows = await db
    .select({ id: sessions.id, ps: sessions.pathStationId })
    .from(sessions)
    .where(eq(sessions.classId, classId))
    .orderBy(asc(sessions.startsAt));
  return rows.map((r) => path!.stations.find((s) => s.pathStationId === r.ps)?.title ?? null);
}

const holdFirst = async (classId: string, n: number) => {
  const rows = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.classId, classId))
    .orderBy(asc(sessions.startsAt))
    .limit(n);
  await db
    .update(sessions)
    .set({ status: "held" })
    .where(
      inArray(
        sessions.id,
        rows.map((r) => r.id),
      ),
    );
};

describe("class paths", () => {
  it("assigns the sessions to stations in order, the rest to the next course", async () => {
    const src = await source();
    const cls = await klass();
    expect(
      await saveClassPath(tid, cls.id, { sourceId: src.id, items: items(src.stations, [3, 2, 3]) }),
    ).toBeNull();
    expect(await sessionStations(cls.id)).toEqual(["S1", "S1", "S1", "S2", "S2", "S3"]);
    const path = await getClassPath(tid, cls.id);
    expect(path?.stations.map((s) => [s.title, s.first, s.last])).toEqual([
      ["S1", 1, 3],
      ["S2", 4, 5],
      ["S3", 6, 6],
    ]);
  });

  it("skips stations the class doesn't take and adds class-only stations", async () => {
    const src = await source();
    const cls = await klass();
    const input: PathInput = {
      sourceId: src.id,
      items: [
        ...items(src.stations.slice(0, 2), [3, 2], [false, true]),
        { kind: "custom", title: "Job interview", plannedSessions: 2, skills: ["a", "b", "c"] },
        ...items(src.stations.slice(2), [3]),
      ],
    };
    expect(await saveClassPath(tid, cls.id, input)).toBeNull();
    expect(await sessionStations(cls.id)).toEqual([
      "S2",
      "S2",
      "Job interview",
      "Job interview",
      "S3",
      "S3",
    ]);
    const custom = (await getClassPath(tid, cls.id))!.stations.find((s) => s.custom)!;
    expect(custom.skills).toEqual(["a", "b", "c"]);
    // Dropping it removes the class-only station.
    expect(
      await saveClassPath(tid, cls.id, { sourceId: src.id, items: items(src.stations, [3, 2, 3]) }),
    ).toBeNull();
    expect(await db.select().from(stations).where(eq(stations.id, custom.stationId))).toEqual([]);
  });

  it("makes a source from the class's own stations, with one skill and many sessions", async () => {
    const cls = await klass();
    const input: PathInput = {
      newSource: { title: "My book" },
      items: [
        { kind: "custom", title: "One", plannedSessions: 7, skills: ["only"] },
        { kind: "custom", title: "Two", plannedSessions: 1, skills: ["a", "b", "c", "d", "e"] },
      ],
    };
    expect(await saveClassPath(tid, cls.id, input)).toBeNull();
    expect(await sessionStations(cls.id)).toEqual(["One", "One", "One", "One", "One", "One"]);
    const made = (await pathSources(tid)).find((x) => x.title === "My book");
    expect(made?.stations.map((x) => x.title)).toEqual(["One", "Two"]);
  });
  it("keeps held sessions and reflows the rest", async () => {
    const src = await source();
    const cls = await klass();
    await saveClassPath(tid, cls.id, { sourceId: src.id, items: items(src.stations, [3, 2, 3]) });
    await holdFirst(cls.id, 2);
    expect(
      await saveClassPath(tid, cls.id, { sourceId: src.id, items: items(src.stations, [2, 3, 3]) }),
    ).toBeNull();
    expect(await sessionStations(cls.id)).toEqual(["S1", "S1", "S2", "S2", "S2", "S3"]);
    expect((await getClassPath(tid, cls.id))!.stations[0].held).toBe(2);
  });

  it("refuses to drop, reorder or shrink a station below its held sessions, or to switch source", async () => {
    const src = await source();
    const other = await source();
    const cls = await klass();
    await saveClassPath(tid, cls.id, { sourceId: src.id, items: items(src.stations, [3, 2, 3]) });
    await holdFirst(cls.id, 2);
    const [a, b, c] = src.stations;
    expect(
      await saveClassPath(tid, cls.id, {
        sourceId: src.id,
        items: items(src.stations, [3, 2, 3], [false, true, true]),
      }),
    ).toBe("locked");
    expect(
      await saveClassPath(tid, cls.id, { sourceId: src.id, items: items([b, a, c], [2, 3, 3]) }),
    ).toBe("locked");
    expect(
      await saveClassPath(tid, cls.id, { sourceId: src.id, items: items(src.stations, [1, 2, 3]) }),
    ).toBe("locked");
    expect(
      await saveClassPath(tid, cls.id, {
        sourceId: other.id,
        items: items(other.stations, [3, 2, 3]),
      }),
    ).toBe("sourceLocked");
    // Nothing changed.
    expect(await sessionStations(cls.id)).toEqual(["S1", "S1", "S1", "S2", "S2", "S3"]);
  });

  it("refuses incomplete, other-level, partly listed and other teachers' sources", async () => {
    const src = await source();
    const cls = await klass();
    const b1 = await source(tid, [2], "B1");
    expect(
      await saveClassPath(tid, cls.id, { sourceId: b1.id, items: items(b1.stations, [2]) }),
    ).toBe("level");
    expect(
      await saveClassPath(tid, cls.id, {
        sourceId: src.id,
        items: items(src.stations.slice(1), [2, 3]),
      }),
    ).toBe("stations");
    const foreign = await source(otherTid);
    expect(
      await saveClassPath(tid, cls.id, {
        sourceId: foreign.id,
        items: items(foreign.stations, [3, 2, 3]),
      }),
    ).toBe("source");
    expect(
      await saveClassPath(otherTid, cls.id, {
        sourceId: foreign.id,
        items: items(foreign.stations, [3, 2, 3]),
      }),
    ).toBe("notFound");
    const half = await createSource(
      newSourceSchema.parse({ title: "Draft", level: "A2", chapters: "2", plannedSessions: "2" }),
      tid,
    );
    const draft = (await getSource(tid, half))!.stations.map((s) => s.id);
    expect(await saveClassPath(tid, cls.id, { sourceId: half, items: items(draft, [2, 2]) })).toBe(
      "incomplete",
    );
    expect((await pathSources(tid, "A2")).map((s) => [s.title, s.complete])).toEqual([
      ["Book", true],
      ["Draft", false],
    ]);
  });

  it("reflows when a session is cancelled", async () => {
    const src = await source();
    const cls = await klass();
    await saveClassPath(tid, cls.id, { sourceId: src.id, items: items(src.stations, [3, 2, 3]) });
    const first = cls.sessions.sort((x, y) => +x.startsAt - +y.startsAt)[0];
    expect(await cancelSession(tid, first.id, null, new Date("2026-11-01T00:00:00Z"))).toBe(true);
    const rows = await db
      .select({ ps: sessions.pathStationId })
      .from(sessions)
      .where(and(eq(sessions.classId, cls.id), eq(sessions.id, first.id)));
    expect(rows[0].ps).toBeNull();
    expect((await sessionStations(cls.id)).filter(Boolean)).toEqual(["S1", "S1", "S1", "S2", "S2"]);
  });
});
