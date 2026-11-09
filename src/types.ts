export type Category =
  | 'magazine'
  | 'bobblehead'
  | 'key'
  | 'holotape'
  | 'unique'
  | 'misc'
  | 'quest'
  | 'unmarked';

export const CATEGORY_LABELS: Record<Category, string> = {
  magazine: 'Magazines',
  bobblehead: 'Bobbleheads',
  key: 'Keys & Passwords',
  holotape: 'Holotapes',
  unique: 'Unique Items',
  misc: 'Misc',
  quest: 'Quests',
  unmarked: 'Unmarked Locations',
};

export const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[];

export type Faction = 'minutemen' | 'brotherhood' | 'railroad' | 'institute' | 'other';

export const FACTION_LABELS: Record<Faction, string> = {
  minutemen: 'Minutemen',
  brotherhood: 'Brotherhood of Steel',
  railroad: 'Railroad',
  institute: 'Institute',
  other: 'Other',
};

/**
 * Map units: the 2048x2048 grid used by the Fallout Wiki's interactive maps,
 * origin top-left, y pointing down. Calibration maps these to image pixels.
 */
export interface Coords {
  x: number;
  y: number;
}

export interface BaseEntry {
  id: string;
  name: string;
  category: Category;
  location: string;
  where: string;
  coords?: Coords;
  /** True when coords point at the location as a whole, not the exact spot. */
  coordsApprox?: boolean;
  relatedQuest?: string;
  missable?: boolean;
  faction?: Faction;
  lockedBy?: { faction?: Faction; note: string };
  verified: boolean;
  source?: string;
}

export interface Magazine extends BaseEntry {
  category: 'magazine';
  title: string;
  issue: number;
  effect: string;
}

export interface Bobblehead extends BaseEntry {
  category: 'bobblehead';
  effect: string;
}

export interface KeyEntry extends BaseEntry {
  category: 'key';
  kind: 'key' | 'keycard' | 'password';
  unlocks: string;
}

export interface Holotape extends BaseEntry {
  category: 'holotape';
  isGame?: boolean;
  summary?: string;
}

export interface UniqueItem extends BaseEntry {
  category: 'unique';
  itemType: 'weapon' | 'armor';
  baseItem?: string;
  effect: string;
  acquisition: 'found' | 'vendor' | 'reward';
}

export interface MiscEntry extends BaseEntry {
  category: 'misc';
  subtype: 'power-armor' | 'perk-item' | 'companion' | 'settlement' | 'other';
  effect?: string;
}

export interface Quest extends BaseEntry {
  category: 'quest';
  questType: 'main' | 'faction' | 'side' | 'misc';
  reward?: string;
  giver?: string;
  prerequisites?: string[];
}

export interface Unmarked extends BaseEntry {
  category: 'unmarked';
  whyVisit: string;
}

export type Entry =
  | Magazine
  | Bobblehead
  | KeyEntry
  | Holotape
  | UniqueItem
  | MiscEntry
  | Quest
  | Unmarked;

/** Named map location from src/data/locations.json, used for "near me" sorting and calibration. */
export interface MapLocation {
  name: string;
  x: number;
  y: number;
}

// ---- user state ----

export type Tint = 'green' | 'amber' | 'blue' | 'white';
export type Font = 'sharetech' | 'vt323';

/** Linear transform from map units to image pixels. */
export interface Calibration {
  ax: number;
  bx: number;
  ay: number;
  by: number;
}

export interface Profile {
  id: string;
  name: string;
  created: string;
  /** entryId -> ISO timestamp of completion */
  done: Record<string, string>;
  notes: Record<string, string>;
}

export interface Settings {
  tint: Tint;
  font: Font;
  scanlines: boolean;
  glow: boolean;
  vignette: boolean;
  flicker: boolean;
  colourMarkers: boolean;
  /** Unset: the map image covers the whole wiki grid. */
  calibration?: Calibration;
  /** User-placed marker positions (map units), keyed by entry id. */
  coordOverrides: Record<string, Coords>;
}

export interface SaveFile {
  app: 'fo4-tracker';
  version: 1;
  activeProfileId: string;
  profiles: Profile[];
  settings: Settings;
}
