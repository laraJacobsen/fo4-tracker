import type { ReactNode } from 'react';
import { CATEGORY_LABELS, FACTION_LABELS, type Entry } from '../types';
import { actions, useProfile, useSettings } from '../state/store';
import { ENTRY_BY_ID } from '../lib/loadData';
import { entryCoords } from '../lib/coords';
import { Badges } from './Badges';

interface Props {
  entry: Entry | undefined;
  onShowOnMap?: (id: string) => void;
  onJump?: (id: string) => void;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  if (children === undefined || children === null || children === '') return null;
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

function QuestRef({ id, onJump }: { id: string; onJump?: (id: string) => void }) {
  const q = ENTRY_BY_ID.get(id);
  if (!q) return <span title="Not in quests.json yet">{id}</span>;
  return onJump ? (
    <button className="link" onClick={() => onJump(id)}>
      {q.name}
    </button>
  ) : (
    <>{q.name}</>
  );
}

function CategoryFields({ e, onJump }: { e: Entry; onJump?: (id: string) => void }) {
  switch (e.category) {
    case 'magazine':
      return (
        <>
          <Field label="TITLE">{e.title}</Field>
          <Field label="ISSUE">#{e.issue}</Field>
          <Field label="EFFECT">{e.effect}</Field>
        </>
      );
    case 'bobblehead':
      return <Field label="EFFECT">{e.effect}</Field>;
    case 'key':
      return (
        <>
          <Field label="TYPE">{e.kind.toUpperCase()}</Field>
          <Field label="UNLOCKS">{e.unlocks}</Field>
        </>
      );
    case 'holotape':
      return (
        <>
          <Field label="CONTENT">{e.summary}</Field>
          <Field label="GAME">{e.isGame ? 'Playable Pip-Boy game' : undefined}</Field>
        </>
      );
    case 'unique':
      return (
        <>
          <Field label="TYPE">{e.itemType.toUpperCase()}</Field>
          <Field label="BASE ITEM">{e.baseItem}</Field>
          <Field label="EFFECT">{e.effect}</Field>
          <Field label="OBTAINED">{{ found: 'Found in world', vendor: 'Sold by vendor', reward: 'Quest reward' }[e.acquisition]}</Field>
        </>
      );
    case 'misc':
      return <Field label="EFFECT">{e.effect}</Field>;
    case 'quest':
      return (
        <>
          <Field label="TYPE">{e.questType.toUpperCase()}</Field>
          <Field label="GIVER">{e.giver}</Field>
          <Field label="REQUIRES">
            {e.prerequisites?.length
              ? e.prerequisites.map((p, i) => (
                  <span key={p}>
                    {i > 0 && ', '}
                    <QuestRef id={p} onJump={onJump} />
                  </span>
                ))
              : undefined}
          </Field>
          <Field label="REWARD">{e.reward}</Field>
        </>
      );
    case 'unmarked':
      return <Field label="WHY GO">{e.whyVisit}</Field>;
  }
}

export function EntryDetail({ entry: e, onShowOnMap, onJump }: Props) {
  const profile = useProfile();
  const settings = useSettings();
  if (!e) return <aside className="detail empty">SELECT AN ENTRY</aside>;
  const done = profile.done[e.id];
  const coords = entryCoords(e, settings);

  return (
    <aside className="detail" aria-label="Details">
      <h2>
        {e.name} <Badges e={e} />
      </h2>
      <div className="detail-sub dim">
        {CATEGORY_LABELS[e.category].toUpperCase()}
      </div>

      <dl>
        <Field label="LOCATION">{e.location}</Field>
        <Field label="WHERE">{e.where}</Field>
        <CategoryFields e={e} onJump={onJump} />
        <Field label="QUEST">{e.relatedQuest ? <QuestRef id={e.relatedQuest} onJump={onJump} /> : undefined}</Field>
        <Field label="FACTION">{e.faction ? FACTION_LABELS[e.faction] : undefined}</Field>
        <Field label="MISSABLE">{e.missable ? 'Yes: can be permanently missed' : undefined}</Field>
        <Field label="LOCKED">
          {e.lockedBy ? `${e.lockedBy.faction ? FACTION_LABELS[e.lockedBy.faction] + ': ' : ''}${e.lockedBy.note}` : undefined}
        </Field>
        <Field label="DATA">
          {e.verified ? 'Verified' : 'UNVERIFIED: double-check in-game'}
          {e.source && (
            <>
              {' · '}
              <a href={e.source} target="_blank" rel="noreferrer">
                source
              </a>
            </>
          )}
        </Field>
        <Field label="DONE">{done ? new Date(done).toLocaleString() : undefined}</Field>
      </dl>

      <div className="detail-actions">
        <button className={done ? 'on' : ''} onClick={() => actions.toggleDone(e.id)}>
          {done ? '■ DONE' : '□ MARK DONE'}
        </button>
        {onShowOnMap && (
          <button onClick={() => onShowOnMap(e.id)} title="Show on map (M)">
            {coords ? 'SHOW ON MAP' : 'PLACE ON MAP'}
          </button>
        )}
      </div>
      {coords && e.coordsApprox && !settings.coordOverrides[e.id] && (
        <div className="dim small">Map marker points at the location, not the exact spot.</div>
      )}

      <label className="notes">
        <span>NOTES</span>
        <textarea
          rows={4}
          value={profile.notes[e.id] ?? ''}
          placeholder="Your own comments…"
          onChange={(ev) => actions.setNote(e.id, ev.target.value)}
        />
      </label>
    </aside>
  );
}
