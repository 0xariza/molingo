import { describe, expect, it } from "vitest";
import { clampPan, clampZoom, gridTileSize, videoFit } from "../video-grid";

describe("gridTileSize", () => {
  it("gives one tile the whole box", () => {
    expect(gridTileSize({ width: 1600, height: 900 }, 1, 12)).toEqual({ width: 1600, height: 900 });
  });

  it("splits the box in half for two: side by side when wide, stacked when tall", () => {
    expect(gridTileSize({ width: 1112, height: 700 }, 2, 12)).toEqual({ width: 550, height: 700 });
    expect(gridTileSize({ width: 700, height: 1112 }, 2, 12)).toEqual({ width: 700, height: 550 });
  });

  it("makes four a 2 x 2 square, and three two on top with one below", () => {
    expect(gridTileSize({ width: 1212, height: 712 }, 4, 12)).toEqual({ width: 600, height: 350 });
    expect(gridTileSize({ width: 1212, height: 712 }, 3, 12)).toEqual({ width: 600, height: 350 });
  });

  it("is zero before the box is measured", () => {
    expect(gridTileSize({ width: 0, height: 0 }, 3, 12)).toEqual({ width: 0, height: 0 });
  });
});

describe("videoFit", () => {
  it("fills, except an upright video in a wide tile shows whole", () => {
    const wide = { width: 1280, height: 720 };
    const tall = { width: 720, height: 1280 };
    expect(videoFit(wide, wide)).toBe("cover");
    expect(videoFit(tall, tall)).toBe("cover");
    expect(videoFit(wide, tall)).toBe("contain");
    expect(videoFit(tall, wide)).toBe("cover");
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
