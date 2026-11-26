import { describe, expect, it } from "vitest";
import { localeAlternates, ogImage } from "../site";

describe("localeAlternates", () => {
  it("is self-canonical, lists every language and sets x-default to Persian", () => {
    const a = localeAlternates("en", "/mona");
    expect(a.canonical).toMatch(/\/en\/mona$/);
    expect(a.languages.fa).toMatch(/\/fa\/mona$/);
    expect(a.languages.en).toMatch(/\/en\/mona$/);
    expect(a.languages["x-default"]).toMatch(/\/fa\/mona$/);
  });
});

describe("ogImage", () => {
  it("has a share image per language at 1200x630", () => {
    expect(ogImage("fa")).toMatchObject({ width: 1200, height: 630 });
    expect(ogImage("fa").url).toMatch(/og-fa\.png$/);
  });
});
