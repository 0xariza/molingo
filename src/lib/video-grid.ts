type Size = { width: number; height: number };

/**
 * Meet-style grid: the tiles fill the whole box (two people split it in half, side by side on a
 * wide box and stacked on a tall one). Picks the column count whose tiles are closest to 4:3,
 * with a penalty for empty cells in the last row (four people make a 2 x 2, not three over one).
 */
export function gridTileSize({ width, height }: Size, count: number, gap: number): Size {
  let best = { width: 0, height: 0 };
  let bestScore = Infinity;
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const w = (width - gap * (cols - 1)) / cols;
    const h = (height - gap * (rows - 1)) / rows;
    if (w <= 0 || h <= 0) continue;
    const score = Math.abs(Math.log(w / h / (4 / 3))) + (1 * (cols * rows - count)) / count;
    if (score < bestScore) {
      bestScore = score;
      best = { width: Math.floor(w), height: Math.floor(h) };
    }
  }
  return best;
}

/**
 * Fill the tile (a crop, as in Meet) except when an upright phone video sits in a wide tile:
 * then show the whole picture, so it isn't cut down to a zoomed-in strip.
 */
export function videoFit(tile: Size, video: Size | null): "cover" | "contain" {
  if (!video || !tile.width || !tile.height) return "cover";
  return tile.width > tile.height && video.height > video.width ? "contain" : "cover";
}

/** A shared screen zooms between its normal size and four times that. */
export const clampZoom = (zoom: number) => Math.min(4, Math.max(1, zoom));

/** The part of a box a fitted (letterboxed) video really covers; the whole box until its size is known. */
export function pictureSize(box: Size, video: Size | null): Size {
  if (!video?.width || !video.height) return box;
  const scale = Math.min(box.width / video.width, box.height / video.height);
  return { width: video.width * scale, height: video.height * scale };
}

/**
 * How far a zoomed picture may move: only the part that sticks out of the box, so no empty edge
 * shows. A shared window that is narrower than the box has bars; those never become pan room.
 */
export function clampPan(
  pan: { x: number; y: number },
  zoom: number,
  box: Size,
  video: Size | null = null,
) {
  const pic = pictureSize(box, video);
  const x = Math.max(0, (pic.width * zoom - box.width) / 2);
  const y = Math.max(0, (pic.height * zoom - box.height) / 2);
  return { x: Math.min(x, Math.max(-x, pan.x)), y: Math.min(y, Math.max(-y, pan.y)) };
}
