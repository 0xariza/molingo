import { describe, expect, it } from "vitest";
import { formatDate, formatTime, formatToman, toLatinDigits } from "./format";

// 2026-10-13 14:30 UTC = 18:00 Tehran = Tuesday 21 Mehr 1405
const d = new Date("2026-10-13T14:30:00Z");

describe("formatDate", () => {
  it("uses the Jalali calendar and Persian digits for fa", () => {
    expect(formatDate(d, "fa")).toBe("سه‌شنبه ۲۱ مهر ۱۴۰۵");
  });
  it("uses the Gregorian calendar for en", () => {
    expect(formatDate(d, "en")).toBe("Tue 13 Oct 2026");
  });
  it("uses the Tehran date, not UTC", () => {
    // 21:00 UTC on 13 Oct is already 14 Oct (Wednesday) in Tehran
    expect(formatDate(new Date("2026-10-13T21:00:00Z"), "en")).toBe("Wed 14 Oct 2026");
  });
  it("handles the Jalali new year (Nowruz)", () => {
    // 1 Farvardin 1406 = 21 March 2027
    expect(formatDate(new Date("2027-03-21T08:00:00Z"), "fa", { weekday: false })).toBe(
      "۱ فروردین ۱۴۰۶",
    );
  });
});

describe("formatTime", () => {
  it("formats Tehran time in both locales", () => {
    expect(formatTime(d, "fa")).toBe("۱۸:۰۰");
    expect(formatTime(d, "en")).toBe("18:00");
  });
});

describe("formatToman", () => {
  it("groups digits per locale", () => {
    expect(formatToman(5_000_000, "fa")).toBe("۵٬۰۰۰٬۰۰۰ تومان");
    expect(formatToman(5_000_000, "en")).toBe("5,000,000 Toman");
  });
});

describe("toLatinDigits", () => {
  it("normalizes Persian and Arabic digits", () => {
    expect(toLatinDigits("۰۹۱۲۳۴۵۶۷۸۹")).toBe("09123456789");
    expect(toLatinDigits("٠١٢٣٤٥٦٧٨٩")).toBe("0123456789");
    expect(toLatinDigits("abc 12")).toBe("abc 12");
  });
});
