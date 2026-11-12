import { describe, expect, it } from "vitest";
import { invoiceState, jalaliMonthLabel, priceOn } from "../pricing";

describe("priceOn", () => {
  const changes = [
    { effectiveFrom: "2026-11-06", priceToman: 700_000 },
    { effectiveFrom: "2026-12-01", priceToman: 750_000 },
  ];
  it("uses the base price before the first change", () => {
    expect(priceOn(650_000, changes, "2026-11-05")).toBe(650_000);
  });
  it("switches on the effective day, not the day before", () => {
    expect(priceOn(650_000, changes, "2026-11-06")).toBe(700_000);
    expect(priceOn(650_000, changes, "2026-11-30")).toBe(700_000);
    expect(priceOn(650_000, changes, "2026-12-01")).toBe(750_000);
  });
  it("does not depend on the order of the changes", () => {
    expect(priceOn(650_000, [...changes].reverse(), "2026-11-20")).toBe(700_000);
  });
});

describe("invoiceState", () => {
  const base = { status: "issued" as const, total: 1000, paid: 0, dueOn: "2026-11-10" };
  it("is open until the due date plus grace days have passed", () => {
    expect(invoiceState(base, 3, "2026-11-13").state).toBe("open");
    expect(invoiceState(base, 3, "2026-11-14").state).toBe("overdue");
    expect(invoiceState(base, 0, "2026-11-11").state).toBe("overdue");
  });
  it("is partial when some is paid, and paid when nothing is left", () => {
    expect(invoiceState({ ...base, paid: 400 }, 3, "2026-11-01")).toMatchObject({
      state: "partial",
      left: 600,
    });
    expect(invoiceState({ ...base, paid: 1000 }, 3, "2026-12-30").state).toBe("paid");
    expect(invoiceState({ ...base, paid: 1200 }, 3, "2026-12-30").left).toBe(0);
  });
  it("keeps the partial flag on an overdue invoice", () => {
    expect(invoiceState({ ...base, paid: 400 }, 3, "2026-12-01")).toMatchObject({
      state: "overdue",
      partial: true,
    });
  });
  it("leaves drafts and voids alone", () => {
    expect(invoiceState({ ...base, status: "draft" }, 3, "2030-01-01").state).toBe("draft");
    expect(invoiceState({ ...base, status: "void" }, 3, "2030-01-01").state).toBe("void");
  });
});

describe("jalaliMonthLabel", () => {
  it("names every Jalali month", () => {
    expect(
      ["1405-01", "1405-06", "1405-07", "1405-08", "1405-12"].map((p) => jalaliMonthLabel(p, "fa")),
    ).toEqual(["فروردین", "شهریور", "مهر", "آبان", "اسفند"]);
  });
});
