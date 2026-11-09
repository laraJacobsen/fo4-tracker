import { ALL_CATEGORIES, CATEGORY_LABELS, type Entry } from '../types';
import { ENTRIES, ENTRY_BY_ID } from '../lib/loadData';
import { actions, useProfile } from '../state/store';
import { Badges } from './Badges';

function Bar({ label, done, total }: { label: string; done: number; total: number }) {
  const pct = total ? (done / total) * 100 : 0;
  return (
    <div className="stat-row">
      <span className="stat-label">{label}</span>
      <span className="meter" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${pct}%` }} />
      </span>
      <span className="stat-num">
        {done}/{total}
      </span>
      <span className="stat-pct">{Math.floor(pct)}%</span>
    </div>
  );
}

export function StatStatus() {
  const profile = useProfile();
  const visible = ENTRIES;
  const count = (list: Entry[]) => [list.filter((e) => profile.done[e.id]).length, list.length] as const;
  const [doneAll, totalAll] = count(visible);
  const unverified = visible.filter((e) => !e.verified).length;

  return (
    <div className="stat-screen">
      <section>
        <h3>OVERALL</h3>
        <Bar label="EVERYTHING" done={doneAll} total={totalAll} />
      </section>
      <section>
        <h3>BY CATEGORY</h3>
        {ALL_CATEGORIES.map((c) => {
          const [d, t] = count(visible.filter((e) => e.category === c));
          return <Bar key={c} label={CATEGORY_LABELS[c].toUpperCase()} done={d} total={t} />;
        })}
      </section>
      <p className="dim small">
        {unverified} of {totalAll} entries are unverified (marked <span className="badge q">?</span>).
      </p>
    </div>
  );
}

export function StatRecent() {
  const profile = useProfile();
  const recent = Object.entries(profile.done)
    .sort((a, b) => b[1].localeCompare(a[1]))
    .slice(0, 40)
    .flatMap(([id, at]) => {
      const e = ENTRY_BY_ID.get(id);
      return e ? [{ e, at }] : [];
    });
  if (!recent.length) return <div className="empty">NOTHING COMPLETED YET</div>;
  return (
    <ul className="plain-list">
      {recent.map(({ e, at }) => (
        <li key={e.id}>
          <span className="dim">{new Date(at).toLocaleDateString()}</span>
          <span className="row-name">{e.name}</span>
          <span className="dim">{CATEGORY_LABELS[e.category]}</span>
          <button onClick={() => actions.toggleDone(e.id)} title="Mark as not done">
            UNDO
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Missable or choice-locked entries that are still open: the "don't forget" list. */
export function StatWarnings({ onJump }: { onJump: (id: string) => void }) {
  const profile = useProfile();
  const open = ENTRIES.filter((e) => (e.missable || e.lockedBy) && !profile.done[e.id]);
  if (!open.length) return <div className="empty">NO OPEN MISSABLE OR LOCKED ENTRIES</div>;
  return (
    <ul className="plain-list">
      {open.map((e) => (
        <li key={e.id}>
          <button className="link row-name" onClick={() => onJump(e.id)}>
            {e.name}
          </button>
          <Badges e={e} />
          <span className="dim">{e.lockedBy?.note ?? 'Can be permanently missed'}</span>
        </li>
      ))}
    </ul>
  );
}
