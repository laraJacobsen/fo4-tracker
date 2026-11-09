import { WEAPON_CLASS_LABELS, type Entry, type Faction } from './types';

export type TopTab = 'STAT' | 'INV' | 'DATA' | 'MAP' | 'RADIO';
export const TOP_TABS: TopTab[] = ['STAT', 'INV', 'DATA', 'MAP', 'RADIO'];

export interface ListView {
  kind: 'list';
  label: string;
  match: (e: Entry) => boolean;
  /** Group header for each entry, shown when the list uses default sort. */
  groupBy?: (e: Entry) => string;
}

export interface OtherView {
  kind: 'stat-status' | 'stat-recent' | 'stat-warnings' | 'radio-display' | 'radio-profiles' | 'radio-backup';
  label: string;
}

export interface MapView {
  kind: 'map';
  label: string;
}

export type View = ListView | OtherView | MapView;

const factionQuests = (f: Faction) => (e: Entry) =>
  e.category === 'quest' && e.questType === 'faction' && e.faction === f;

export const SUB_TABS: Record<TopTab, View[]> = {
  STAT: [
    { kind: 'stat-status', label: 'STATUS' },
    { kind: 'stat-recent', label: 'RECENT' },
    { kind: 'stat-warnings', label: 'MISSABLE' },
  ],
  INV: [
    {
      kind: 'list',
      label: 'MAGAZINES',
      match: (e) => e.category === 'magazine',
      groupBy: (e) => (e.category === 'magazine' ? e.title : ''),
    },
    { kind: 'list', label: 'BOBBLEHEADS', match: (e) => e.category === 'bobblehead' },
    {
      kind: 'list',
      label: 'KEYS',
      match: (e) => e.category === 'key',
      groupBy: (e) => (e.category === 'key' ? { key: 'Keys', keycard: 'Keycards', password: 'Passwords' }[e.kind] : ''),
    },
    { kind: 'list', label: 'HOLOTAPES', match: (e) => e.category === 'holotape' },
    {
      kind: 'list',
      label: 'WEAPONS',
      match: (e) => e.category === 'unique' && e.itemType === 'weapon',
      groupBy: (e) => (e.category === 'unique' && e.weaponClass ? WEAPON_CLASS_LABELS[e.weaponClass] : 'Other'),
    },
    { kind: 'list', label: 'APPAREL', match: (e) => e.category === 'unique' && e.itemType === 'armor' },
    {
      kind: 'list',
      label: 'MISC',
      match: (e) => e.category === 'misc',
      groupBy: (e) =>
        e.category === 'misc'
          ? {
              'power-armor': 'Power Armor',
              'perk-item': 'Perk Items',
              companion: 'Companions',
              settlement: 'Settlements',
              other: 'Other',
            }[e.subtype]
          : '',
    },
  ],
  DATA: [
    { kind: 'list', label: 'MAIN', match: (e) => e.category === 'quest' && e.questType === 'main' },
    { kind: 'list', label: 'MINUTEMEN', match: factionQuests('minutemen') },
    { kind: 'list', label: 'BROTHERHOOD', match: factionQuests('brotherhood') },
    { kind: 'list', label: 'RAILROAD', match: factionQuests('railroad') },
    { kind: 'list', label: 'INSTITUTE', match: factionQuests('institute') },
    { kind: 'list', label: 'SIDE', match: (e) => e.category === 'quest' && e.questType === 'side' },
    { kind: 'list', label: 'MISC', match: (e) => e.category === 'quest' && e.questType === 'misc' },
    { kind: 'list', label: 'LOCATIONS', match: (e) => e.category === 'unmarked' },
  ],
  MAP: [
    { kind: 'map', label: 'COMMONWEALTH' },
  ],
  RADIO: [
    { kind: 'radio-display', label: 'DISPLAY' },
    { kind: 'radio-profiles', label: 'PROFILES' },
    { kind: 'radio-backup', label: 'BACKUP' },
  ],
};
