import type { Calibration, Coords, Entry, Settings } from '../types';

/** Size of the Fallout Wiki map grid the coordinates are expressed in. */
export const MAP_UNITS = { w: 2048, h: 2048 };

/** Map image file names tried in public/, in order. */
export const MAP_IMAGES = ['map.jpg', 'map.png', 'map.webp'];

/** Coordinates to use for an entry: a user override wins over the data file. */
export function entryCoords(e: Entry, settings: Settings): Coords | undefined {
  return settings.coordOverrides[e.id] ?? e.coords;
}

/** Default calibration: the image covers the whole wiki grid. */
export function defaultCalibration(imgW: number, imgH: number): Calibration {
  return { ax: imgW / MAP_UNITS.w, bx: 0, ay: imgH / MAP_UNITS.h, by: 0 };
}

export function toPixels(c: { x: number; y: number }, cal: Calibration) {
  return { px: c.x * cal.ax + cal.bx, py: c.y * cal.ay + cal.by };
}

export function toUnits(px: number, py: number, cal: Calibration) {
  return { x: (px - cal.bx) / cal.ax, y: (py - cal.by) / cal.ay };
}

/**
 * Solve a per-axis scale+offset from two landmarks whose map units are known
 * and whose pixel positions were clicked on the image.
 */
export function solveCalibration(
  a: { x: number; y: number; px: number; py: number },
  b: { x: number; y: number; px: number; py: number },
): Calibration | string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) < 50 || Math.abs(dy) < 50) {
    return 'Pick two landmarks that are far apart both horizontally and vertically.';
  }
  const ax = (b.px - a.px) / dx;
  const ay = (b.py - a.py) / dy;
  if (ax <= 0 || ay <= 0) return 'The clicks seem swapped or mirrored. Try again.';
  return { ax, bx: a.px - ax * a.x, ay, by: a.py - ay * a.y };
}

export function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
