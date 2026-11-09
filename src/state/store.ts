import { useSyncExternalStore } from 'react';
import { ALL_DLC, type Coords, type Profile, type SaveFile, type Settings, type World, type Calibration } from '../types';

const STORAGE_KEY = 'fo4-tracker:v1';

export const DEFAULT_SETTINGS: Settings = {
  tint: 'green',
  font: 'sharetech',
  scanlines: true,
  glow: true,
  vignette: true,
  flicker: false,
  colourMarkers: true,
  calibration: {},
  coordOverrides: {},
};

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function newProfile(name: string): Profile {
  return { id: newId(), name, created: new Date().toISOString(), done: {}, notes: {}, enabledDLC: [...ALL_DLC] };
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
  const profiles = d.profiles.map((p) => ({
    ...newProfile(p.name ?? 'Unnamed'),
    ...p,
    done: p.done ?? {},
    notes: p.notes ?? {},
    enabledDLC: p.enabledDLC ?? [...ALL_DLC],
  }));
  const active = profiles.some((p) => p.id === d.activeProfileId) ? d.activeProfileId! : profiles[0].id;
  return {
    app: 'fo4-tracker',
    version: 1,
    activeProfileId: active,
    profiles,
    settings: { ...DEFAULT_SETTINGS, ...d.settings },
  };
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
  setEnabledDLC(dlc: Profile['enabledDLC']) {
    updateProfile((p) => ({ ...p, enabledDLC: dlc }));
  },
  updateSettings(patch: Partial<Settings>) {
    set({ ...state, settings: { ...state.settings, ...patch } });
  },
  setCalibration(world: World, cal: Calibration | undefined) {
    const calibration = { ...state.settings.calibration };
    if (cal) calibration[world] = cal;
    else delete calibration[world];
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
