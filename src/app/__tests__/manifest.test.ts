import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import manifest from "../manifest";

describe("web app manifest", () => {
  const m = manifest();

  it("is installable: standalone, a start URL and 192 + 512 icons", () => {
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/");
    const sizes = (m.icons ?? []).map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
  });

  it("has a maskable icon and every icon file exists in public/", () => {
    expect((m.icons ?? []).some((i) => i.purpose === "maskable")).toBe(true);
    for (const icon of m.icons ?? []) expect(existsSync(`public${icon.src}`)).toBe(true);
  });
});
