import type { Category, Entry, MapLocation } from '../types';
import magazines from '../data/magazines.json';
import bobbleheads from '../data/bobbleheads.json';
import keys from '../data/keys.json';
import holotapes from '../data/holotapes.json';
import uniques from '../data/uniques.json';
import misc from '../data/misc.json';
import quests from '../data/quests.json';
import unmarked from '../data/unmarked.json';
import locations from '../data/locations.json';

const files: Record<Category, unknown[]> = {
  magazine: magazines,
  bobblehead: bobbleheads,
  key: keys,
  holotape: holotapes,
  unique: uniques,
  misc,
  quest: quests,
  unmarked,
};

function load(): Entry[] {
  const out: Entry[] = [];
  const seen = new Set<string>();
  for (const [category, list] of Object.entries(files)) {
    for (const raw of list as Entry[]) {
      if (!raw.id || !raw.name) {
        console.warn(`[data] ${category}: entry without id/name`, raw);
        continue;
      }
      if (seen.has(raw.id)) console.warn(`[data] duplicate id "${raw.id}"`);
      if (raw.category !== category) console.warn(`[data] "${raw.id}" has category "${raw.category}" but is in ${category}.json`);
      seen.add(raw.id);
      out.push(raw);
    }
  }
  return out;
}

export const ENTRIES: Entry[] = load();
export const ENTRY_BY_ID = new Map(ENTRIES.map((e) => [e.id, e]));
export const LOCATIONS = locations as MapLocation[];
