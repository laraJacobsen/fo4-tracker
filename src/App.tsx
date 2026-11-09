import { useCallback, useEffect, useRef, useState } from 'react';
import { SUB_TABS, TOP_TABS, type TopTab, type View } from './views';
import { DEFAULT_FILTERS, type Filters } from './lib/search';
import { ENTRY_BY_ID } from './lib/loadData';
import { useSettings } from './state/store';
import { StatusBar, SubTabs, TopTabs } from './components/Shell';
import { ListScreen } from './components/ListScreen';
import { StatRecent, StatStatus, StatWarnings } from './components/StatScreens';
import { RadioBackup, RadioContent, RadioDisplay, RadioProfiles } from './components/RadioScreens';
import { MapScreen } from './components/MapScreen';
import { isTyping } from './components/EntryList';
import { worldOf } from './lib/coords';

export default function App() {
  const settings = useSettings();
  const [top, setTop] = useState<TopTab>('INV');
  const [subIndex, setSubIndex] = useState<Record<TopTab, number>>({ STAT: 0, INV: 1, DATA: 0, MAP: 0, RADIO: 0 });
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState<string>();
  const [mapFocus, setMapFocus] = useState<{ id: string; place: boolean }>();
  const searchRef = useRef<HTMLInputElement>(null);

  const views = SUB_TABS[top];
  const sub = Math.min(subIndex[top], views.length - 1);
  const view: View = views[sub];

  const goSub = useCallback(
    (i: number) => setSubIndex((s) => ({ ...s, [top]: (i + views.length) % views.length })),
    [top, views.length],
  );

  /** Open the list tab that contains an entry and select it. */
  const jumpTo = useCallback((id: string) => {
    const e = ENTRY_BY_ID.get(id);
    if (!e) return;
    for (const t of ['INV', 'DATA'] as TopTab[]) {
      const i = SUB_TABS[t].findIndex((v) => v.kind === 'list' && v.match(e));
      if (i >= 0) {
        setTop(t);
        setSubIndex((s) => ({ ...s, [t]: i }));
        setFilters((f) => ({ ...f, query: '' }));
        setSelectedId(id);
        return;
      }
    }
  }, []);

  /** Switch to the map for this entry's world; place mode if it has no coordinates. */
  const showOnMap = useCallback(
    (id: string) => {
      const e = ENTRY_BY_ID.get(id);
      if (!e) return;
      const c = settings.coordOverrides[id] ?? e.coords;
      const world = c ? worldOf(c) : e.dlc === 'farharbor' ? 'farharbor' : e.dlc === 'nukaworld' ? 'nukaworld' : 'commonwealth';
      setTop('MAP');
      setSubIndex((s) => ({ ...s, MAP: SUB_TABS.MAP.findIndex((v) => v.kind === 'map' && v.world === world) }));
      setSelectedId(id);
      setMapFocus({ id, place: !c });
    },
    [settings.coordOverrides],
  );

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (isTyping(ev.target)) {
        if (ev.key === 'Escape') (ev.target as HTMLElement).blur();
        return;
      }
      const i = TOP_TABS.indexOf(top);
      if (ev.key === 'Tab') {
        ev.preventDefault();
        setTop(TOP_TABS[(i + (ev.shiftKey ? -1 : 1) + TOP_TABS.length) % TOP_TABS.length]);
      } else if (ev.key === 'q' || ev.key === 'Q') {
        goSub(sub - 1);
      } else if (ev.key === 'e' || ev.key === 'E') {
        goSub(sub + 1);
      } else if (ev.key === '/') {
        ev.preventDefault();
        if (top !== 'INV' && top !== 'DATA') setTop('INV');
        setTimeout(() => searchRef.current?.focus(), 0);
      } else if (/^[1-5]$/.test(ev.key)) {
        setTop(TOP_TABS[Number(ev.key) - 1]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [top, sub, goSub]);

  const fx = [
    `tint-${settings.tint}`,
    settings.font === 'vt323' ? 'font-vt323' : '',
    settings.glow ? 'fx-glow' : '',
    settings.flicker ? 'fx-flicker' : '',
  ].join(' ');

  useEffect(() => {
    // Keep the page background/scrollbars in the chosen tint too.
    document.documentElement.className = `tint-${settings.tint}`;
  }, [settings.tint]);

  return (
    <div className={`pipboy ${fx}`}>
      <div className="screen">
        <TopTabs active={top} onChange={setTop} />
        <SubTabs views={views} active={sub} onChange={goSub} />
        <main key={`${top}-${sub}`} className="content tab-enter">
          {view.kind === 'list' && (
            <ListScreen
              ref={searchRef}
              view={view}
              filters={filters}
              onFilters={setFilters}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onShowOnMap={showOnMap}
              onJump={jumpTo}
            />
          )}
          {view.kind === 'stat-status' && <StatStatus />}
          {view.kind === 'stat-recent' && <StatRecent />}
          {view.kind === 'stat-warnings' && <StatWarnings onJump={jumpTo} />}
          {view.kind === 'map' && (
            <MapScreen
              world={view.world}
              focus={mapFocus}
              onFocusHandled={() => setMapFocus(undefined)}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onJump={jumpTo}
            />
          )}
          {view.kind === 'radio-display' && <RadioDisplay />}
          {view.kind === 'radio-content' && <RadioContent />}
          {view.kind === 'radio-profiles' && <RadioProfiles />}
          {view.kind === 'radio-backup' && <RadioBackup />}
        </main>
        <StatusBar />
      </div>
      {settings.scanlines && <div className="crt-layer crt-scanlines" aria-hidden />}
      {settings.vignette && <div className="crt-layer crt-vignette" aria-hidden />}
    </div>
  );
}
