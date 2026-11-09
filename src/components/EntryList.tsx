import { useEffect, useMemo, useRef } from 'react';
import type { Entry, MapLocation } from '../types';
import { CATEGORY_LABELS } from '../types';
import { actions, useProfile, useSettings } from '../state/store';
import { distanceFrom } from '../lib/search';
import { Badges } from './Badges';
import { isTyping } from '../lib/dom';

type Row = { kind: 'header'; label: string; done: number; total: number } | { kind: 'entry'; e: Entry; index: number };

interface Props {
  entries: Entry[];
  groupBy?: (e: Entry) => string;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  showCategory: boolean;
  near?: MapLocation;
  onShowOnMap?: (id: string) => void;
}

export function EntryList({ entries, groupBy, selectedId, onSelect, showCategory, near, onShowOnMap }: Props) {
  const profile = useProfile();
  const settings = useSettings();
  const rowRefs = useRef(new Map<string, HTMLLIElement>());

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    if (!groupBy) {
      entries.forEach((e, index) => out.push({ kind: 'entry', e, index }));
      return out;
    }
    // Keep data-file order within groups, but gather each group together.
    const groups = new Map<string, Entry[]>();
    for (const e of entries) {
      const g = groupBy(e);
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(e);
    }
    let index = 0;
    for (const [label, list] of groups) {
      out.push({ kind: 'header', label, done: list.filter((e) => profile.done[e.id]).length, total: list.length });
      for (const e of list) out.push({ kind: 'entry', e, index: index++ });
    }
    return out;
  }, [entries, groupBy, profile.done]);

  const ordered = useMemo(() => rows.flatMap((r) => (r.kind === 'entry' ? [r.e] : [])), [rows]);
  const selIndex = Math.max(0, ordered.findIndex((e) => e.id === selectedId));

  // Keep a valid selection when the list changes.
  useEffect(() => {
    if (ordered.length && !ordered.some((e) => e.id === selectedId)) onSelect(ordered[0].id);
  }, [ordered, selectedId, onSelect]);

  useEffect(() => {
    if (selectedId) rowRefs.current.get(selectedId)?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (isTyping(ev.target) || ev.ctrlKey || ev.metaKey || ev.altKey || !ordered.length) return;
      const move = (to: number) => {
        ev.preventDefault();
        onSelect(ordered[Math.max(0, Math.min(ordered.length - 1, to))].id);
      };
      switch (ev.key) {
        case 'ArrowDown':
          return move(selIndex + 1);
        case 'ArrowUp':
          return move(selIndex - 1);
        case 'PageDown':
          return move(selIndex + 10);
        case 'PageUp':
          return move(selIndex - 10);
        case 'Home':
          return move(0);
        case 'End':
          return move(ordered.length - 1);
        case 'Enter':
        case ' ':
          ev.preventDefault();
          actions.toggleDone(ordered[selIndex].id);
          return;
        case 'm':
        case 'M':
          if (onShowOnMap) onShowOnMap(ordered[selIndex].id);
          return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ordered, selIndex, onSelect, onShowOnMap]);

  if (!entries.length) return <div className="entry-list empty">NO ENTRIES MATCH</div>;

  return (
    <ul className="entry-list" role="listbox" aria-label="Entries" aria-activedescendant={selectedId ? `row-${selectedId}` : undefined}>
      {rows.map((r) =>
        r.kind === 'header' ? (
          <li key={`h-${r.label}`} className="group-header" role="presentation">
            <span>{r.label}</span>
            <span className="dim">
              {r.done}/{r.total}
            </span>
          </li>
        ) : (
          <li
            key={r.e.id}
            id={`row-${r.e.id}`}
            ref={(el) => {
              if (el) rowRefs.current.set(r.e.id, el);
              else rowRefs.current.delete(r.e.id);
            }}
            role="option"
            aria-selected={r.e.id === selectedId}
            className={[
              'entry-row',
              r.e.id === selectedId ? 'selected' : '',
              profile.done[r.e.id] ? 'done' : '',
            ].join(' ')}
            onClick={() => onSelect(r.e.id)}
            onDoubleClick={() => actions.toggleDone(r.e.id)}
          >
            <span
              className={profile.done[r.e.id] ? 'box checked' : 'box'}
              role="checkbox"
              aria-checked={!!profile.done[r.e.id]}
              aria-label="Done"
              onClick={(ev) => {
                ev.stopPropagation();
                onSelect(r.e.id);
                actions.toggleDone(r.e.id);
              }}
            />
            <span className="row-name">
              {r.e.name}
              {profile.notes[r.e.id] && <span className="note-mark" title="Has notes">✎</span>}
            </span>
            <Badges e={r.e} />
            <span className="row-meta">
              {showCategory && <span className="row-cat">{CATEGORY_LABELS[r.e.category]}</span>}
              {near ? <Distance e={r.e} near={near} settings={settings} /> : r.e.location}
            </span>
          </li>
        ),
      )}
    </ul>
  );
}

function Distance({ e, near, settings }: { e: Entry; near: MapLocation; settings: ReturnType<typeof useSettings> }) {
  const d = distanceFrom(e, near, settings);
  if (d === undefined) return <>— · {e.location}</>;
  const c = settings.coordOverrides[e.id] ?? e.coords!;
  return (
    <>
      {d < 15 ? 'HERE' : `${compass(c.x - near.x, c.y - near.y)} ${Math.round(d)}`} · {e.location}
    </>
  );
}

const DIRS = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];

/** Compass direction for a map-unit offset (y grows southwards). */
function compass(dx: number, dy: number) {
  const a = (Math.atan2(dy, dx) * 180) / Math.PI;
  return DIRS[(Math.round(a / 45) + 8) % 8];
}
