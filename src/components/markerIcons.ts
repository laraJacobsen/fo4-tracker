import type { Category } from '../types';

/** Original SVG marker shapes, one per category, in a 20x20 box. */
const SHAPES: Record<Category, string> = {
  magazine: '<rect x="4" y="3" width="12" height="14"/>',
  bobblehead: '<circle cx="10" cy="10" r="6.5"/>',
  key: '<path d="M10 3 L17 16 L3 16 Z"/>',
  holotape: '<rect x="3" y="6" width="14" height="8" rx="1"/>',
  unique: '<path d="M10 2 L18 10 L10 18 L2 10 Z"/>',
  misc: '<path d="M10 2.5 L16.5 6.25 V13.75 L10 17.5 L3.5 13.75 V6.25 Z"/>',
  quest: '<path d="M10 2 L12.2 7.4 L18 7.6 L13.4 11.2 L15 16.8 L10 13.6 L5 16.8 L6.6 11.2 L2 7.6 L7.8 7.4 Z"/>',
  unmarked: '<path d="M8 3 H12 V8 H17 V12 H12 V17 H8 V12 H3 V8 H8 Z"/>',
};

export const CATEGORY_COLOURS: Record<Category, string> = {
  magazine: '#ffd166',
  bobblehead: '#1aff80',
  key: '#ff8c42',
  holotape: '#b28dff',
  unique: '#ff5d73',
  misc: '#4cc9f0',
  quest: '#f8f8f2',
  unmarked: '#a3e635',
};

export function markerSvg(category: Category, fill: string, size = 20) {
  return `<svg viewBox="0 0 20 20" width="${size}" height="${size}" aria-hidden="true"><g fill="${fill}" stroke="#000" stroke-width="1.4" stroke-linejoin="round">${SHAPES[category]}</g></svg>`;
}
