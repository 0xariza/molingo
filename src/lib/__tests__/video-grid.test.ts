import { describe, expect, it } from "vitest";
import { clampPan, clampZoom, gridTileSize, pictureSize, videoFit } from "../video-grid";

describe("gridTileSize", () => {
  it("gives one tile the biggest 16:9 that fits", () => {
    expect(gridTileSize({ width: 1600, height: 900 }, 1, 12)).toEqual({ width: 1600, height: 900 });
    expect(gridTileSize({ width: 2000, height: 900 }, 1, 12)).toEqual({ width: 1600, height: 900 });
  });

  it("puts two side by side when wide and stacked when tall, always 16:9", () => {
    expect(gridTileSize({ width: 1600, height: 700 }, 2, 12)).toEqual({ width: 794, height: 446 });
    expect(gridTileSize({ width: 700, height: 1112 }, 2, 12)).toEqual({ width: 700, height: 393 });
  });

  it("makes four a 2 x 2 and three two on top with one below", () => {
    expect(gridTileSize({ width: 1212, height: 712 }, 4, 12)).toEqual({ width: 600, height: 337 });
    expect(gridTileSize({ width: 1212, height: 712 }, 3, 12)).toEqual({ width: 600, height: 337 });
  });

  it("is zero before the box is measured", () => {
    expect(gridTileSize({ width: 0, height: 0 }, 3, 12)).toEqual({ width: 0, height: 0 });
  });
});

describe("videoFit", () => {
  const hd = { width: 1280, height: 720 };
  it("fills only when the shapes nearly match", () => {
    expect(videoFit(hd, hd)).toBe("cover");
    expect(videoFit({ width: 1300, height: 700 }, hd)).toBe("cover");
    expect(videoFit(hd, null)).toBe("cover");
  });

  it("shows the whole picture instead of zooming in", () => {
    expect(videoFit(hd, { width: 640, height: 480 })).toBe("contain"); // 4:3 webcam
    expect(videoFit(hd, { width: 720, height: 1280 })).toBe("contain"); // upright phone
    expect(videoFit({ width: 2000, height: 870 }, hd)).toBe("contain"); // wide spotlight
    expect(videoFit({ width: 250, height: 600 }, hd)).toBe("contain"); // tall strip
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

describe("pictureSize and clampPan with a letterboxed window share", () => {
  const box = { width: 800, height: 400 };
  const portrait = { width: 600, height: 1200 }; // a tall window shown in a wide box

  it("measures the part of the box the picture covers", () => {
    expect(pictureSize(box, portrait)).toEqual({ width: 200, height: 400 });
    expect(pictureSize(box, null)).toEqual(box);
    expect(pictureSize(box, { width: 0, height: 0 })).toEqual(box);
  });

  it("gives no sideways room until the picture is wider than the box", () => {
    expect(clampPan({ x: 300, y: 300 }, 2, box, portrait)).toEqual({ x: 0, y: 200 });
    expect(clampPan({ x: 300, y: 300 }, 4, box, portrait)).toEqual({ x: 0, y: 300 });
  });
});
