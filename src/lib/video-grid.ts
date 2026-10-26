type Size = { width: number; height: number };

/**
 * Meet-style grid: the widest 16:9 tile that fits `count` tiles in the box with `gap` between
 * them, trying every column count.
 */
export function bestTileWidth({ width, height }: Size, count: number, gap: number): number {
  let best = 0;
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const fit = Math.min(
      (width - gap * (cols - 1)) / cols,
      ((height - gap * (rows - 1)) / rows) * (16 / 9),
    );
    best = Math.max(best, fit);
  }
  return Math.max(0, Math.floor(best));
}

/**
 * Fill the tile (a slight crop) when video and tile are both wide or both tall; show the whole
 * picture when they differ, so an upright phone isn't cut down to a zoomed-in strip.
 */
export function videoFit(tile: Size, video: Size | null): "cover" | "contain" {
  if (!video || !tile.width || !tile.height) return "cover";
  return tile.width >= tile.height === video.width >= video.height ? "cover" : "contain";
}
