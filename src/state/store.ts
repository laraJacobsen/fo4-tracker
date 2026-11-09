import { useSyncExternalStore } from 'react';
import type { Coords, Profile, SaveFile, Settings, Calibration } from '../types';

const STORAGE_KEY = 'fo4-tracker:v1';

export const DEFAULT_SETTINGS: Settings = {
  tint: 'green',
  font: 'sharetech',
  scanlines: true,
  glow: true,
  vignette: true,
  flicker: false,
  colourMarkers: true,
  coordOverrides: {},
};

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function newProfile(name: string): Profile {
  return { id: newId(), name, created: new Date().toISOString(), done: {}, notes: {} };
}

function freshSave(): SaveFile {
  const p = newProfile('Sole Survivor');
  return { app: 'fo4-tracker', version: 1, activeProfileId: p.id, profiles: [p], settings: { ...DEFAULT_SETTINGS } };
}

/** Throws a readable error if `data` is not a usable save file. Fills in missing fields. */
export function validateSave(data: unknown): SaveFile {
  const d = data as Partial<SaveFile> | null;
  if (!d || typeof d !== 'object' || d.app !== 'fo4-tracker') throw new Error('Not an FO4 tracker save file.');
  if (d.version !== 1) throw new Error(`Unsupported save version: ${String(d.version)}`);
  if (!Array.isArray(d.profiles) || d.profiles.length === 0) throw new Error('Save file contains no profiles.');
  const profiles = d.profiles.map((p) => {
    // Older saves carried per-profile DLC toggles; the tracker is base game only now.
    const rest: Partial<Profile> & { enabledDLC?: unknown } = { ...p };
    delete rest.enabledDLC;
    return { ...newProfile(p.name ?? 'Unnamed'), ...rest, done: p.done ?? {}, notes: p.notes ?? {} };
  });
  const active = profiles.some((p) => p.id === d.activeProfileId) ? d.activeProfileId! : profiles[0].id;
  return {
    app: 'fo4-tracker',
    version: 1,
    activeProfileId: active,
    profiles,
    settings: migrateSettings(d.settings),
  };
}

/**
 * Older saves stored calibration and placed markers per map (Commonwealth,
 * Far Harbor, Nuka-World). Keep the Commonwealth ones and drop the rest.
 */
function migrateSettings(raw: Partial<Settings> | undefined): Settings {
  const s = { ...DEFAULT_SETTINGS, ...raw };
  const cal = s.calibration as unknown as Record<string, unknown> | undefined;
  if (cal && !('ax' in cal)) s.calibration = cal.commonwealth as Calibration | undefined;
  if (!s.calibration) delete s.calibration;
  const overrides: Record<string, Coords> = {};
  for (const [id, c] of Object.entries(s.coordOverrides ?? {})) {
    const world = (c as Coords & { world?: string }).world;
    if (world && world !== 'commonwealth') continue;
    overrides[id] = { x: c.x, y: c.y };
  }
  s.coordOverrides = overrides;
  return s;
}

function loadSave(): SaveFile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return validateSave(JSON.parse(raw));
  } catch (err) {
    console.error('[store] could not load save, starting fresh', err);
  }
  return freshSave();
}

let state: SaveFile = loadSave();
const listeners = new Set<() => void>();
let lastSaved = Date.now();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    lastSaved = Date.now();
  } catch (err) {
    console.error('[store] could not save', err);
  }
}

function set(next: SaveFile) {
  state = next;
  persist();
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useSave(): SaveFile {
  return useSyncExternalStore(subscribe, () => state);
}

export function useProfile(): Profile {
  const s = useSave();
  return s.profiles.find((p) => p.id === s.activeProfileId) ?? s.profiles[0];
}

export function useSettings(): Settings {
  return useSave().settings;
}

export function getSave(): SaveFile {
  return state;
}

export function getLastSaved(): number {
  return lastSaved;
}

function updateProfile(fn: (p: Profile) => Profile) {
  set({ ...state, profiles: state.profiles.map((p) => (p.id === state.activeProfileId ? fn(p) : p)) });
}

export const actions = {
  toggleDone(id: string) {
    updateProfile((p) => {
      const done = { ...p.done };
      if (done[id]) delete done[id];
      else done[id] = new Date().toISOString();
      return { ...p, done };
    });
  },
  setNote(id: string, text: string) {
    updateProfile((p) => {
      const notes = { ...p.notes };
      if (text.trim()) notes[id] = text;
      else delete notes[id];
      return { ...p, notes };
    });
  },
  updateSettings(patch: Partial<Settings>) {
    set({ ...state, settings: { ...state.settings, ...patch } });
  },
  setCalibration(calibration: Calibration | undefined) {
    actions.updateSettings({ calibration });
  },
  setCoordOverride(id: string, coords: Coords | undefined) {
    const coordOverrides = { ...state.settings.coordOverrides };
    if (coords) coordOverrides[id] = coords;
    else delete coordOverrides[id];
    actions.updateSettings({ coordOverrides });
  },
  addProfile(name: string) {
    const p = newProfile(name);
    set({ ...state, profiles: [...state.profiles, p], activeProfileId: p.id });
  },
  switchProfile(id: string) {
    set({ ...state, activeProfileId: id });
  },
  renameProfile(id: string, name: string) {
    set({ ...state, profiles: state.profiles.map((p) => (p.id === id ? { ...p, name } : p)) });
  },
  deleteProfile(id: string) {
    const profiles = state.profiles.filter((p) => p.id !== id);
    if (profiles.length === 0) profiles.push(newProfile('Sole Survivor'));
    const activeProfileId = profiles.some((p) => p.id === state.activeProfileId) ? state.activeProfileId : profiles[0].id;
    set({ ...state, profiles, activeProfileId });
  },
  resetProfileProgress(id: string) {
    set({ ...state, profiles: state.profiles.map((p) => (p.id === id ? { ...p, done: {}, notes: {} } : p)) });
  },
  replaceAll(save: SaveFile) {
    set(save);
  },
  wipeEverything() {
    set(freshSave());
  },
};
