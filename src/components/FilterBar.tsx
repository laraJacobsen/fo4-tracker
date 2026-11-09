import { forwardRef } from 'react';
import { ALL_CATEGORIES, ALL_DLC, CATEGORY_LABELS, DLC_LABELS, FACTION_LABELS, type Category, type DLC, type Faction } from '../types';
import type { Filters, SortMode, StatusFilter } from '../lib/search';
import { LOCATIONS } from '../lib/loadData';
import { WORLD_LABELS } from '../types';

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
  /** Show the category picker (used while searching across everything). */
  showCategory: boolean;
}

const sortedLocations = [...LOCATIONS].sort((a, b) => a.name.localeCompare(b.name));

export const FilterBar = forwardRef<HTMLInputElement, Props>(function FilterBar({ filters: f, onChange, showCategory }, searchRef) {
  const set = (patch: Partial<Filters>) => onChange({ ...f, ...patch });
  const nearKey = f.near ? `${f.near.world}|${f.near.name}` : '';
  return (
    <div className="filter-bar">
      <input
        ref={searchRef}
        type="search"
        className="search"
        placeholder="SEARCH ALL… ( / )"
        aria-label="Search all entries by name or location"
        value={f.query}
        onChange={(ev) => set({ query: ev.target.value })}
      />
      {showCategory && (
        <select aria-label="Category" value={f.category} onChange={(ev) => set({ category: ev.target.value as Category | 'all' })}>
          <option value="all">ALL CATEGORIES</option>
          {ALL_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c].toUpperCase()}
            </option>
          ))}
        </select>
      )}
      <select aria-label="Status" value={f.status} onChange={(ev) => set({ status: ev.target.value as StatusFilter })}>
        <option value="all">ALL</option>
        <option value="todo">NOT DONE</option>
        <option value="done">DONE</option>
      </select>
      <select aria-label="DLC" value={f.dlc} onChange={(ev) => set({ dlc: ev.target.value as DLC | 'all' })}>
        <option value="all">ANY DLC</option>
        {ALL_DLC.map((d) => (
          <option key={d} value={d}>
            {DLC_LABELS[d].toUpperCase()}
          </option>
        ))}
      </select>
      <select aria-label="Faction" value={f.faction} onChange={(ev) => set({ faction: ev.target.value as Faction | 'all' })}>
        <option value="all">ANY FACTION</option>
        {(Object.keys(FACTION_LABELS) as Faction[]).map((x) => (
          <option key={x} value={x}>
            {FACTION_LABELS[x].toUpperCase()}
          </option>
        ))}
      </select>
      <label className="check">
        <input type="checkbox" checked={f.missableOnly} onChange={(ev) => set({ missableOnly: ev.target.checked })} />
        MISSABLE/LOCKED
      </label>
      <label className="check">
        <input type="checkbox" checked={f.unverifiedOnly} onChange={(ev) => set({ unverifiedOnly: ev.target.checked })} />
        UNVERIFIED
      </label>
      <select aria-label="Sort" value={f.sort} onChange={(ev) => set({ sort: ev.target.value as SortMode })}>
        <option value="default">SORT: DEFAULT</option>
        <option value="name">SORT: NAME</option>
        <option value="location">SORT: LOCATION</option>
        <option value="near">SORT: NEAREST TO…</option>
      </select>
      {f.sort === 'near' && (
        <select
          aria-label="Current location"
          value={nearKey}
          onChange={(ev) => {
            const [world, name] = ev.target.value.split('|');
            set({ near: LOCATIONS.find((l) => l.world === world && l.name === name) });
          }}
        >
          <option value="">I AM AT…</option>
          {(['commonwealth', 'farharbor', 'nukaworld'] as const).map((w) => (
            <optgroup key={w} label={WORLD_LABELS[w]}>
              {sortedLocations
                .filter((l) => l.world === w)
                .map((l) => (
                  <option key={l.name} value={`${w}|${l.name}`}>
                    {l.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      )}
    </div>
  );
});
