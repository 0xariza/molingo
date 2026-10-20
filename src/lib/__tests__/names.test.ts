import { describe, expect, it } from "vitest";
import { learnerNames, splitBookingName } from "../names";

describe("learnerNames", () => {
  const both = { fullNameFa: "سارا احمدی", fullNameEn: "Sara Ahmadi" };

  it("leads with the name in the page's language", () => {
    expect(learnerNames(both, "fa")).toEqual({ primary: "سارا احمدی", secondary: "Sara Ahmadi" });
    expect(learnerNames(both, "en")).toEqual({ primary: "Sara Ahmadi", secondary: "سارا احمدی" });
  });

  it("falls back to the Persian name in English", () => {
    expect(learnerNames({ fullNameFa: "مهسا", fullNameEn: null }, "en")).toEqual({
      primary: "مهسا",
      secondary: null,
    });
  });
});

describe("splitBookingName", () => {
  it("puts the booking name in the field matching its script", () => {
    expect(splitBookingName("سارا احمدی")).toEqual({ fullNameFa: "سارا احمدی", fullNameEn: null });
    expect(splitBookingName("Sara Ahmadi")).toEqual({ fullNameFa: "", fullNameEn: "Sara Ahmadi" });
  });
});
