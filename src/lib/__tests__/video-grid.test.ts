import { describe, expect, it } from "vitest";
import { bestTileWidth, videoFit } from "../video-grid";

describe("bestTileWidth", () => {
  it("gives one tile the most a 16:9 box allows", () => {
    expect(bestTileWidth({ width: 1600, height: 900 }, 1, 12)).toBe(1600);
    expect(bestTileWidth({ width: 1600, height: 450 }, 1, 12)).toBe(800);
  });

  it("picks the column count with the biggest tiles", () => {
    // Four on a wide screen: 2 × 2 beats 4 × 1 and 1 × 4.
    expect(bestTileWidth({ width: 1200, height: 700 }, 4, 12)).toBe(594);
    // Two on a wide, short screen sit side by side.
    expect(bestTileWidth({ width: 1400, height: 400 }, 2, 12)).toBe(694);
  });

  it("is zero before the box is measured", () => {
    expect(bestTileWidth({ width: 0, height: 0 }, 3, 12)).toBe(0);
  });
});

describe("videoFit", () => {
  it("fills when the shapes match and shows everything when they don't", () => {
    const wide = { width: 1280, height: 720 };
    const tall = { width: 720, height: 1280 };
    expect(videoFit(wide, wide)).toBe("cover");
    expect(videoFit(tall, tall)).toBe("cover");
    expect(videoFit(wide, tall)).toBe("contain");
    expect(videoFit(tall, wide)).toBe("contain");
    expect(videoFit(wide, null)).toBe("cover");
  });
});
