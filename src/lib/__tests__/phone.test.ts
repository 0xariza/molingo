import { describe, expect, it } from "vitest";
import { formatPhone, normalizePhone } from "../phone";

describe("normalizePhone", () => {
  it.each([
    "09121234567",
    "9121234567",
    "+989121234567",
    "00989121234567",
    "0912 123 4567",
    "0912-123-4567",
    "۰۹۱۲۱۲۳۴۵۶۷",
    "٠٩١٢١٢٣٤٥٦٧",
  ])("normalizes %s", (input) => {
    expect(normalizePhone(input)).toBe("+989121234567");
  });

  it("keeps foreign numbers given with a + prefix", () => {
    expect(normalizePhone("+44 7911 123456")).toBe("+447911123456");
  });

  it.each(["", "abc", "0912", "091212345678901", "+98 21"])("rejects %s", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});

describe("formatPhone", () => {
  it("writes Iranian numbers the local way and others internationally", () => {
    expect(formatPhone("+989123456789")).toBe("0912 345 6789");
    expect(formatPhone("+447700900123")).toBe("+44 7700 900123");
  });
});
