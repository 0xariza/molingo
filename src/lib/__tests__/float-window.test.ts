import { describe, expect, it } from "vitest";
import { canAutoFloat } from "../float-window";

describe("canAutoFloat", () => {
  it("is false when the whole screen is shared", () => {
    expect(canAutoFloat("monitor")).toBe(false);
  });

  it("is true for a window, a tab or an unknown surface", () => {
    expect(canAutoFloat("window")).toBe(true);
    expect(canAutoFloat("browser")).toBe(true);
    expect(canAutoFloat(undefined)).toBe(true);
  });
});
