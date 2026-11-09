import { forwardRef, useMemo } from 'react';
import type { ListView } from '../views';
import { ENTRIES, ENTRY_BY_ID } from '../lib/loadData';
import { applyFilters, type Filters } from '../lib/search';
import { useProfile, useSettings } from '../state/store';
import { FilterBar } from './FilterBar';
import { EntryList } from './EntryList';
import { EntryDetail } from './EntryDetail';

interface Props {
  view: ListView;
  filters: Filters;
  onFilters: (f: Filters) => void;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  onShowOnMap: (id: string) => void;
  onJump: (id: string) => void;
}

/** INV and DATA sub-tabs: filters on top, list on the left, details on the right. */
export const ListScreen = forwardRef<HTMLInputElement, Props>(function ListScreen(
  { view, filters, onFilters, selectedId, onSelect, onShowOnMap, onJump },
  searchRef,
) {
  const profile = useProfile();
  const settings = useSettings();
  const searching = filters.query.trim() !== '';

  const entries = useMemo(() => {
    // A search looks across every category; otherwise the sub-tab decides.
    const base = searching ? ENTRIES : ENTRIES.filter(view.match);
    return applyFilters(base, searching ? filters : { ...filters, category: 'all' }, profile, settings);
  }, [view, filters, searching, profile, settings]);

  const total = searching ? entries.length : ENTRIES.filter(view.match).filter((e) => profile.enabledDLC.includes(e.dlc)).length;
  const grouped = !searching && filters.sort === 'default' ? view.groupBy : undefined;

  return (
    <div className="list-screen">
      <FilterBar ref={searchRef} filters={filters} onChange={onFilters} showCategory={searching} />
      <div className="list-caption dim">
        {searching ? `SEARCH: ${entries.length} RESULT${entries.length === 1 ? '' : 'S'}` : `${entries.length} OF ${total} SHOWN`}
        {' · '}
        {entries.filter((e) => profile.done[e.id]).length} DONE
      </div>
      <div className="list-body">
        <EntryList
          entries={entries}
          groupBy={grouped}
          selectedId={selectedId}
          onSelect={onSelect}
          showCategory={searching}
          near={filters.sort === 'near' ? filters.near : undefined}
          onShowOnMap={onShowOnMap}
        />
        <EntryDetail entry={selectedId ? ENTRY_BY_ID.get(selectedId) : undefined} onShowOnMap={onShowOnMap} onJump={onJump} />
      </div>
    </div>
  );
});
