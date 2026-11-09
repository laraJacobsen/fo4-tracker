import type { Calibration, Coords, Entry, Settings, World } from '../types';

/** Size of the Fallout Wiki map grid each world's coordinates are expressed in. */
export const WORLD_UNITS: Record<World, { w: number; h: number }> = {
  commonwealth: { w: 2048, h: 2048 },
  farharbor: { w: 1994, h: 1945 },
  nukaworld: { w: 2048, h: 2048 },
};

export const MAP_IMAGES: Record<World, string> = {
  commonwealth: 'map.jpg',
  farharbor: 'map-farharbor.jpg',
  nukaworld: 'map-nukaworld.jpg',
};

export function worldOf(c: Coords): World {
  return c.world ?? 'commonwealth';
}

/** Coordinates to use for an entry: a user override wins over the data file. */
export function entryCoords(e: Entry, settings: Settings): Coords | undefined {
  return settings.coordOverrides[e.id] ?? e.coords;
}

/** Default calibration: the image covers the whole wiki grid. */
export function defaultCalibration(world: World, imgW: number, imgH: number): Calibration {
  const u = WORLD_UNITS[world];
  return { ax: imgW / u.w, bx: 0, ay: imgH / u.h, by: 0 };
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
