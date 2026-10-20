import { describe, expect, it } from "vitest";
import { fromTehranTime } from "../format";
import {
  addDays,
  busyMinutes,
  formatClock,
  formatHours,
  nextDateOn,
  parseClock,
  sessionTimes,
  weekdayOf,
  weekStartOf,
} from "../schedule";

describe("parseClock", () => {
  it.each([
    ["18:30", 1110],
    ["1830", 1110],
    ["۱۸:۳۰", 1110],
    ["8:05", 485],
    ["00:00", 0],
  ])("reads %s", (input, minutes) => {
    expect(parseClock(input)).toBe(minutes);
  });

  it.each(["", "24:00", "18:60", "abc", "183"])("refuses %s", (input) => {
    expect(parseClock(input)).toBeNull();
  });
});

describe("calendar helpers", () => {
  it("formats minutes, wrapping past midnight", () => {
    expect(formatClock(1110)).toBe("18:30");
    expect(formatClock(1440 + 30)).toBe("00:30");
  });

  it("numbers the week from Saturday", () => {
    expect(weekdayOf("2026-10-24")).toBe(0); // Saturday 2 Aban 1405
    expect(weekdayOf("2026-10-23")).toBe(6); // Friday
  });

  it("adds days across month and year ends", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("finds the next date on given weekdays", () => {
    expect(nextDateOn("2026-10-24", [0, 2])).toBe("2026-10-26"); // Sat → Mon
    expect(nextDateOn("2026-10-26", [0, 2])).toBe("2026-10-31"); // Mon → Sat
  });
});

describe("sessionTimes", () => {
  it("lays sessions on the weekly slots from the start date, in Tehran time", () => {
    const times = sessionTimes({
      startsOn: "2026-10-24", // Saturday
      slots: [
        { weekday: 0, minutes: 18 * 60 },
        { weekday: 2, minutes: 17 * 60 + 30 },
      ],
      count: 3,
      sessionMinutes: 90,
    });
    expect(times.map((t) => t.startsAt)).toEqual([
      fromTehranTime("2026-10-24", "18:00"),
      fromTehranTime("2026-10-26", "17:30"),
      fromTehranTime("2026-10-31", "18:00"),
    ]);
    expect(times[0].endsAt).toEqual(fromTehranTime("2026-10-24", "19:30"));
  });

  it("crosses Nowruz without skipping or doubling a week", () => {
    const times = sessionTimes({
      startsOn: "2027-03-13", // Saturday before Nowruz
      slots: [{ weekday: 0, minutes: 600 }],
      count: 3,
      sessionMinutes: 60,
    });
    expect(times.map((t) => t.startsAt)).toEqual([
      fromTehranTime("2027-03-13", "10:00"),
      fromTehranTime("2027-03-20", "10:00"),
      fromTehranTime("2027-03-27", "10:00"),
    ]);
  });

  it("returns nothing without slots", () => {
    expect(
      sessionTimes({ startsOn: "2026-10-24", slots: [], count: 5, sessionMinutes: 60 }),
    ).toEqual([]);
  });
});

describe("weekStartOf", () => {
  it("starts the week on Saturday", () => {
    expect(weekStartOf("2026-10-17")).toBe("2026-10-17");
    expect(weekStartOf("2026-10-23")).toBe("2026-10-17");
    expect(weekStartOf("2026-10-24")).toBe("2026-10-24");
  });

  it("keeps a week whole across a Jalali month (Mehr → Aban)", () => {
    // Fri 2026-10-23 is 1 Aban; its week began on 25 Mehr.
    expect(weekStartOf("2026-10-23")).toBe("2026-10-17");
  });

  it("starts the new Jalali year (Nowruz) on a fresh week when 1 Farvardin is a Saturday", () => {
    expect(weekStartOf("2026-03-20")).toBe("2026-03-14"); // 29 Esfand 1404
    expect(weekStartOf("2026-03-21")).toBe("2026-03-21"); // 1 Farvardin 1405
  });

  it("moves by whole weeks, across the Gregorian year too", () => {
    expect(weekStartOf("2026-12-31", 1)).toBe("2027-01-02");
    expect(weekStartOf("2026-10-20", -1)).toBe("2026-10-10");
  });
});

describe("busyMinutes", () => {
  const span = (date: string, from: string, to: string) => ({
    startsAt: fromTehranTime(date, from),
    endsAt: fromTehranTime(date, to),
  });
  const week = [
    span("2026-10-17", "10:30", "12:00"),
    span("2026-10-17", "23:40", "23:59"),
    span("2026-10-18", "18:00", "18:20"),
  ];

  it("adds up a week, or one Tehran day of it", () => {
    expect(busyMinutes(week)).toBe(90 + 19 + 20);
    expect(busyMinutes(week, "2026-10-17")).toBe(109);
    expect(busyMinutes(week, "2026-10-19")).toBe(0);
  });

  it("formats hours and minutes", () => {
    expect(formatHours(790)).toBe("13:10");
    expect(formatHours(45)).toBe("0:45");
    expect(formatHours(29 * 60)).toBe("29:00");
  });
});
