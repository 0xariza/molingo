import { describe, expect, it } from "vitest";
import { bestTileWidth, clampPan, clampZoom, videoFit } from "../video-grid";

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

describe("clampZoom", () => {
  it("keeps zoom between normal size and four times", () => {
    expect(clampZoom(0.5)).toBe(1);
    expect(clampZoom(2.5)).toBe(2.5);
    expect(clampZoom(9)).toBe(4);
  });
});

describe("clampPan", () => {
  const box = { width: 800, height: 400 };
  it("lets a zoomed picture move only as far as it sticks out", () => {
    // At 2×, the picture is 1600 × 800: 400 px spare on each side, 200 above and below.
    expect(clampPan({ x: 1000, y: -1000 }, 2, box)).toEqual({ x: 400, y: -200 });
    expect(clampPan({ x: -50, y: 30 }, 2, box)).toEqual({ x: -50, y: 30 });
  });

  it("pins the picture in place at normal size", () => {
    expect(clampPan({ x: 120, y: 80 }, 1, box)).toEqual({ x: 0, y: 0 });
  });
});
