import { useRef, useState } from 'react';
import { ALL_DLC, DLC_LABELS, WORLD_LABELS, type Settings, type Tint, type World } from '../types';
import { actions, useProfile, useSave, useSettings } from '../state/store';
import { exportSave, importSave } from '../state/exportImport';
import { ENTRIES } from '../lib/loadData';

const TINTS: Tint[] = ['green', 'amber', 'blue', 'white'];

function Toggle({ k, label }: { k: keyof Settings; label: string }) {
  const s = useSettings();
  return (
    <label className="check setting">
      <input type="checkbox" checked={!!s[k]} onChange={(ev) => actions.updateSettings({ [k]: ev.target.checked })} />
      {label}
    </label>
  );
}

export function RadioDisplay() {
  const s = useSettings();
  return (
    <div className="radio-screen">
      <section>
        <h3>COLOUR</h3>
        <div className="row-buttons">
          {TINTS.map((t) => (
            <button key={t} className={s.tint === t ? 'on' : ''} onClick={() => actions.updateSettings({ tint: t })}>
              <span className={`swatch tint-${t}`} /> {t}
            </button>
          ))}
        </div>
      </section>
      <section>
        <h3>FONT</h3>
        <div className="row-buttons">
          <button className={s.font === 'sharetech' ? 'on' : ''} onClick={() => actions.updateSettings({ font: 'sharetech' })}>
            Share Tech Mono
          </button>
          <button
            className={s.font === 'vt323' ? 'on' : ''}
            style={{ fontFamily: 'VT323, monospace', fontSize: '1.25em' }}
            onClick={() => actions.updateSettings({ font: 'vt323' })}
          >
            VT323
          </button>
        </div>
      </section>
      <section>
        <h3>CRT EFFECTS</h3>
        <Toggle k="scanlines" label="SCANLINES" />
        <Toggle k="glow" label="PHOSPHOR GLOW" />
        <Toggle k="vignette" label="VIGNETTE" />
        <Toggle k="flicker" label="FLICKER" />
      </section>
      <section>
        <h3>MAP</h3>
        <Toggle k="colourMarkers" label="COLOUR-CODE MARKERS BY CATEGORY" />
      </section>
    </div>
  );
}

export function RadioContent() {
  const profile = useProfile();
  const toggle = (d: (typeof ALL_DLC)[number]) => {
    const on = profile.enabledDLC.includes(d);
    actions.setEnabledDLC(on ? profile.enabledDLC.filter((x) => x !== d) : [...profile.enabledDLC, d]);
  };
  return (
    <div className="radio-screen">
      <section>
        <h3>CONTENT FOR “{profile.name.toUpperCase()}”</h3>
        <p className="dim small">Disabled content is hidden from lists, the map and completion totals for this profile.</p>
        {ALL_DLC.map((d) => {
          const n = ENTRIES.filter((e) => e.dlc === d).length;
          return (
            <label key={d} className="check setting">
              <input type="checkbox" checked={profile.enabledDLC.includes(d)} disabled={d === 'base'} onChange={() => toggle(d)} />
              {DLC_LABELS[d].toUpperCase()} <span className="dim">({n} entries)</span>
            </label>
          );
        })}
      </section>
    </div>
  );
}

export function RadioProfiles() {
  const save = useSave();
  const [newName, setNewName] = useState('');
  return (
    <div className="radio-screen">
      <section>
        <h3>SAVE PROFILES</h3>
        <ul className="plain-list">
          {save.profiles.map((p) => {
            const active = p.id === save.activeProfileId;
            return (
              <li key={p.id} className={active ? 'active-profile' : ''}>
                <span className="row-name">
                  {active ? '▶ ' : '  '}
                  {p.name}
                </span>
                <span className="dim">{Object.keys(p.done).length} done</span>
                {!active && <button onClick={() => actions.switchProfile(p.id)}>LOAD</button>}
                <button
                  onClick={() => {
                    const name = prompt('Rename profile', p.name);
                    if (name?.trim()) actions.renameProfile(p.id, name.trim());
                  }}
                >
                  RENAME
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Clear all progress and notes in “${p.name}”?`)) actions.resetProfileProgress(p.id);
                  }}
                >
                  RESET
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete profile “${p.name}”? This cannot be undone.`)) actions.deleteProfile(p.id);
                  }}
                >
                  DELETE
                </button>
              </li>
            );
          })}
        </ul>
        <form
          className="row-buttons"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (newName.trim()) actions.addProfile(newName.trim());
            setNewName('');
          }}
        >
          <input value={newName} onChange={(ev) => setNewName(ev.target.value)} placeholder="New character name" aria-label="New profile name" />
          <button type="submit" disabled={!newName.trim()}>
            NEW PROFILE
          </button>
        </form>
      </section>
    </div>
  );
}

export function RadioBackup() {
  const s = useSettings();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const overrides = Object.keys(s.coordOverrides).length;
  const calibrated = (Object.keys(s.calibration) as World[]).map((w) => WORLD_LABELS[w]);

  return (
    <div className="radio-screen">
      <section>
        <h3>BACKUP</h3>
        <p className="dim small">
          Everything is stored in this browser only. Export a JSON file to back up all profiles and settings, or to move them to
          another device.
        </p>
        <div className="row-buttons">
          <button onClick={exportSave}>EXPORT JSON</button>
          <button onClick={() => fileRef.current?.click()}>IMPORT JSON</button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (ev) => {
              const file = ev.target.files?.[0];
              ev.target.value = '';
              if (!file) return;
              if (!confirm('Importing replaces ALL current profiles and settings. Continue?')) return;
              try {
                setMsg(await importSave(file));
              } catch (err) {
                setMsg(`IMPORT FAILED: ${(err as Error).message}`);
              }
            }}
          />
        </div>
        {msg && <p>{msg}</p>}
      </section>
      <section>
        <h3>MAP DATA</h3>
        <p className="dim small">
          Calibrated maps: {calibrated.length ? calibrated.join(', ') : 'none'} · Hand-placed markers: {overrides}
        </p>
        <div className="row-buttons">
          <button
            disabled={!overrides}
            onClick={async () => {
              await navigator.clipboard.writeText(JSON.stringify(s.coordOverrides, null, 2));
              setMsg('Marker positions copied. Paste the coords into the matching entries in src/data/*.json.');
            }}
          >
            COPY PLACED MARKERS
          </button>
        </div>
      </section>
      <section>
        <h3>DANGER ZONE</h3>
        <div className="row-buttons">
          <button
            onClick={() => {
              if (confirm('Delete ALL profiles, progress, notes and settings? Export a backup first if unsure.')) actions.wipeEverything();
            }}
          >
            WIPE EVERYTHING
          </button>
        </div>
      </section>
    </div>
  );
}
