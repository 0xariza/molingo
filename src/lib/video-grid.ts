type Size = { width: number; height: number };

/**
 * Meet-style grid: every tile is 16:9 (the camera's own shape, so nothing is cropped), as big as
 * fits. Picks the column count that gives the largest tiles (two people sit side by side on a wide
 * box and stack on a tall one; four make a 2 x 2).
 */
export function gridTileSize({ width, height }: Size, count: number, gap: number): Size {
  let best = { width: 0, height: 0 };
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const cellW = (width - gap * (cols - 1)) / cols;
    const cellH = (height - gap * (rows - 1)) / rows;
    if (cellW <= 0 || cellH <= 0) continue;
    const w = Math.floor(Math.min(cellW, (cellH * 16) / 9));
    if (w > best.width) best = { width: w, height: Math.floor((w * 9) / 16) };
  }
  return best;
}

/**
 * Fill the tile only when the shapes nearly match (at most ~10% of the picture is cut, as in Meet);
 * otherwise show the whole picture with bars, so a 4:3 webcam or an upright phone isn't zoomed in.
 */
export function videoFit(tile: Size, video: Size | null): "cover" | "contain" {
  if (!video?.width || !video.height || !tile.width || !tile.height) return "cover";
  const mismatch = Math.abs(Math.log(tile.width / tile.height / (video.width / video.height)));
  return mismatch <= Math.log(1.1) ? "cover" : "contain";
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
