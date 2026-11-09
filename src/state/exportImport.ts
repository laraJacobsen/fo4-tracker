import { actions, getSave, validateSave } from './store';

export function exportSave() {
  const json = JSON.stringify(getSave(), null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fo4-tracker-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Reads a backup file and replaces all profiles and settings with it. */
export async function importSave(file: File): Promise<string> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('File is not valid JSON.');
  }
  const save = validateSave(parsed);
  actions.replaceAll(save);
  const done = save.profiles.reduce((n, p) => n + Object.keys(p.done).length, 0);
  return `Imported ${save.profiles.length} profile(s), ${done} completed entries.`;
}
