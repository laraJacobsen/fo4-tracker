import type { Category, DLC, Entry, Faction, MapLocation, Profile, Settings } from '../types';
import { distance, entryCoords, worldOf } from './coords';

export type StatusFilter = 'all' | 'todo' | 'done';
export type SortMode = 'default' | 'name' | 'location' | 'near';

export interface Filters {
  query: string;
  category: Category | 'all';
  status: StatusFilter;
  dlc: DLC | 'all';
  missableOnly: boolean;
  faction: Faction | 'all';
  unverifiedOnly: boolean;
  sort: SortMode;
  near?: MapLocation;
}

export const DEFAULT_FILTERS: Filters = {
  query: '',
  category: 'all',
  status: 'all',
  dlc: 'all',
  missableOnly: false,
  faction: 'all',
  unverifiedOnly: false,
  sort: 'default',
};

function haystack(e: Entry): string {
  const extra = 'title' in e ? e.title : '';
  return `${e.name} ${e.location} ${e.where} ${extra}`.toLowerCase();
}

export function factionOf(e: Entry): Faction | undefined {
  return e.faction ?? e.lockedBy?.faction;
}

export function isVisibleForProfile(e: Entry, profile: Profile) {
  return profile.enabledDLC.includes(e.dlc);
}

export function applyFilters(entries: Entry[], f: Filters, profile: Profile, settings: Settings): Entry[] {
  const terms = f.query.toLowerCase().split(/\s+/).filter(Boolean);
  const out = entries.filter((e) => {
    if (!isVisibleForProfile(e, profile)) return false;
    if (f.category !== 'all' && e.category !== f.category) return false;
    if (f.status === 'done' && !profile.done[e.id]) return false;
    if (f.status === 'todo' && profile.done[e.id]) return false;
    if (f.dlc !== 'all' && e.dlc !== f.dlc) return false;
    if (f.missableOnly && !e.missable && !e.lockedBy) return false;
    if (f.faction !== 'all' && factionOf(e) !== f.faction) return false;
    if (f.unverifiedOnly && e.verified) return false;
    if (terms.length) {
      const h = haystack(e);
      if (!terms.every((t) => h.includes(t))) return false;
    }
    return true;
  });
  return sortEntries(out, f, settings);
}

export function sortEntries(list: Entry[], f: Filters, settings: Settings): Entry[] {
  switch (f.sort) {
    case 'name':
      return [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    case 'location':
      return [...list].sort((a, b) => a.location.localeCompare(b.location) || a.name.localeCompare(b.name));
    case 'near': {
      const here = f.near;
      if (!here) return list;
      const d = (e: Entry) => {
        const c = entryCoords(e, settings);
        return c && worldOf(c) === here.world ? distance(c, here) : Infinity;
      };
      return [...list].sort((a, b) => d(a) - d(b));
    }
    default:
      return list;
  }
}

/** Distance in map units from the "near" location, for display. */
export function distanceFrom(e: Entry, here: MapLocation | undefined, settings: Settings): number | undefined {
  const c = entryCoords(e, settings);
  if (!here || !c || worldOf(c) !== here.world) return undefined;
  return distance(c, here);
}
