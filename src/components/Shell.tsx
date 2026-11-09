import { useEffect, useRef } from 'react';
import { TOP_TABS, type TopTab, type View } from '../views';
import { useProfile } from '../state/store';
import { ENTRIES } from '../lib/loadData';
import { isVisibleForProfile } from '../lib/search';

export function TopTabs({ active, onChange }: { active: TopTab; onChange: (t: TopTab) => void }) {
  return (
    <nav className="top-tabs" role="tablist" aria-label="Sections">
      {TOP_TABS.map((t) => (
        <button
          key={t}
          role="tab"
          aria-selected={t === active}
          tabIndex={-1}
          className={t === active ? 'top-tab active' : 'top-tab'}
          onClick={() => onChange(t)}
        >
          {t}
        </button>
      ))}
    </nav>
  );
}

export function SubTabs({ views, active, onChange }: { views: View[]; active: number; onChange: (i: number) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    refs.current[active]?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [active, views]);
  return (
    <nav className="sub-tabs" role="tablist" aria-label="Sub-sections">
      {views.map((v, i) => (
        <button
          key={v.label}
          ref={(el) => {
            refs.current[i] = el;
          }}
          role="tab"
          aria-selected={i === active}
          tabIndex={-1}
          className={i === active ? 'sub-tab active' : 'sub-tab'}
          onClick={() => onChange(i)}
        >
          {v.label}
        </button>
      ))}
    </nav>
  );
}

export function StatusBar() {
  const profile = useProfile();
  const visible = ENTRIES.filter((e) => isVisibleForProfile(e, profile));
  const done = visible.filter((e) => profile.done[e.id]).length;
  const pct = visible.length ? Math.floor((done / visible.length) * 100) : 0;
  return (
    <footer className="status-bar">
      <span className="status-cell">{profile.name.toUpperCase()}</span>
      <span className="status-cell grow">
        COMPLETION {done}/{visible.length}
        <span className="status-meter" aria-hidden>
          <span style={{ width: `${pct}%` }} />
        </span>
        {pct}%
      </span>
      <span className="status-cell hints">TAB section · Q/E sub · ↑↓ select · ENTER done · / search</span>
    </footer>
  );
}
