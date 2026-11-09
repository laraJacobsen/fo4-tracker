import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { ALL_CATEGORIES, CATEGORY_LABELS, type Calibration, type Category, type Entry, type MapLocation } from '../types';
import { ENTRIES, ENTRY_BY_ID, LOCATIONS } from '../lib/loadData';
import { defaultCalibration, entryCoords, MAP_IMAGE, MAP_UNITS, solveCalibration, toPixels, toUnits } from '../lib/coords';
import type { StatusFilter } from '../lib/search';
import { actions, useProfile, useSettings } from '../state/store';
import { CATEGORY_COLOURS, markerSvg } from './markerIcons';
import { EntryDetail } from './EntryDetail';
import { isTyping } from '../lib/dom';

interface Props {
  focus?: { id: string; place: boolean };
  onFocusHandled: () => void;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  onJump: (id: string) => void;
}

interface ImageInfo {
  w: number;
  h: number;
  url?: string; // undefined: no image file, draw a grid instead
}

interface CalibState {
  a: string;
  b: string;
  pa?: { px: number; py: number };
  pb?: { px: number; py: number };
  result?: Calibration;
  error?: string;
}

const FOCUS_ZOOM = 0.5;

function defaultLandmarks(): [string, string] {
  const by = (f: (l: MapLocation) => number) => LOCATIONS.reduce((best, l) => (f(l) < f(best) ? l : best)).name;
  // Opposite corners give the most accurate fit.
  return [by((l) => l.x + l.y), by((l) => -(l.x + l.y))];
}

export function MapScreen({ focus, onFocusHandled, selectedId, onSelect, onJump }: Props) {
  const profile = useProfile();
  const settings = useSettings();
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayer = useRef<L.LayerGroup | null>(null);
  const labelLayer = useRef<L.LayerGroup | null>(null);
  const clickRef = useRef<(px: number, py: number) => void>(() => {});

  const [img, setImg] = useState<ImageInfo>();
  const [mapReady, setMapReady] = useState(false);
  const [cats, setCats] = useState<Set<Category>>(() => new Set(ALL_CATEGORIES));
  const [status, setStatus] = useState<StatusFilter>('all');
  const [showLabels, setShowLabels] = useState(false);
  const [placingId, setPlacingId] = useState<string>();
  const [calib, setCalib] = useState<CalibState | null>(null);
  const [groupIds, setGroupIds] = useState<string[]>();

  // ---- load the map image (or fall back to a grid) ----
  useEffect(() => {
    const url = `${import.meta.env.BASE_URL}${MAP_IMAGE}`;
    const im = new Image();
    im.onload = () => setImg({ w: im.naturalWidth, h: im.naturalHeight, url });
    im.onerror = () => setImg({ ...MAP_UNITS });
    im.src = url;
  }, []);

  const savedCal = useMemo(
    () => (img ? settings.calibration ?? defaultCalibration(img.w, img.h) : undefined),
    [img, settings.calibration],
  );
  const cal = calib?.result ?? savedCal;

  // ---- create the Leaflet map ----
  useEffect(() => {
    if (!img || !elRef.current) return;
    const map = L.map(elRef.current, {
      crs: L.CRS.Simple,
      minZoom: -4,
      maxZoom: 3,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      attributionControl: false,
    });
    const bounds = L.latLngBounds([-img.h, 0], [0, img.w]);
    if (img.url) {
      L.imageOverlay(img.url, bounds, { className: 'map-image' }).addTo(map);
    } else {
      for (let x = 0; x <= img.w; x += 128) L.polyline([[0, x], [-img.h, x]], { className: x % 512 ? 'map-grid' : 'map-grid major', interactive: false }).addTo(map);
      for (let y = 0; y <= img.h; y += 128) L.polyline([[-y, 0], [-y, img.w]], { className: y % 512 ? 'map-grid' : 'map-grid major', interactive: false }).addTo(map);
    }
    map.fitBounds(bounds);
    map.setMaxBounds(bounds.pad(0.3));
    labelLayer.current = L.layerGroup().addTo(map);
    markerLayer.current = L.layerGroup().addTo(map);
    map.on('click', (ev: L.LeafletMouseEvent) => clickRef.current(ev.latlng.lng, -ev.latlng.lat));
    mapRef.current = map;
    setMapReady(true);
    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [img]);

  // ---- entries on this map ----
  const mapEntries = useMemo(() => ENTRIES.filter((e) => entryCoords(e, settings)), [settings]);

  const shown = useMemo(
    () =>
      mapEntries.filter((e) => {
        if (!cats.has(e.category)) return false;
        if (status === 'done' && !profile.done[e.id]) return false;
        if (status === 'todo' && profile.done[e.id]) return false;
        return true;
      }),
    [mapEntries, cats, status, profile.done],
  );

  const noCoords = ENTRIES.length - mapEntries.length;

  // ---- draw markers, grouping entries that share a spot ----
  useEffect(() => {
    const layer = markerLayer.current;
    if (!layer || !cal) return;
    layer.clearLayers();
    const groups = new Map<string, Entry[]>();
    for (const e of shown) {
      const c = entryCoords(e, settings)!;
      const k = `${Math.round(c.x)}|${Math.round(c.y)}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(e);
    }
    for (const list of groups.values()) {
      const first = list[0];
      const { px, py } = toPixels(entryCoords(first, settings)!, cal);
      const allDone = list.every((e) => profile.done[e.id]);
      const selected = list.some((e) => e.id === selectedId);
      const fill = settings.colourMarkers ? CATEGORY_COLOURS[first.category] : 'var(--pip)';
      const count = list.length > 1 ? `<span class="mk-count">${list.length}</span>` : '';
      const icon = L.divIcon({
        className: `mk${allDone ? ' mk-done' : ''}${selected ? ' mk-selected' : ''}`,
        html: markerSvg(first.category, fill) + count,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      const m = L.marker([-py, px], { icon, keyboard: false, zIndexOffset: selected ? 1000 : allDone ? -1000 : 0 });
      m.bindTooltip(
        list.length > 1 ? `${first.location} (${list.length})` : first.name,
        { direction: 'top', offset: [0, -10], className: 'map-tip' },
      );
      m.on('click', () => {
        setGroupIds(list.length > 1 ? list.map((e) => e.id) : undefined);
        onSelect((list.find((e) => !profile.done[e.id]) ?? first).id);
      });
      m.addTo(layer);
    }
  }, [shown, cal, settings, profile.done, selectedId, onSelect, mapReady]);

  // ---- named location dots (useful for checking calibration) ----
  const calLandmarks = calib ? [calib.a, calib.b] : [];
  const labelsOn = showLabels || !img?.url || !!calib;
  useEffect(() => {
    const layer = labelLayer.current;
    if (!layer || !cal) return;
    layer.clearLayers();
    if (!labelsOn) return;
    for (const l of LOCATIONS) {
      const { px, py } = toPixels(l, cal);
      const landmark = calLandmarks.includes(l.name);
      L.circleMarker([-py, px], { radius: landmark ? 6 : 3, className: landmark ? 'map-loc landmark' : 'map-loc', interactive: true })
        .bindTooltip(l.name, { permanent: landmark, direction: 'right', className: 'map-tip map-loc-tip' })
        .addTo(layer);
    }
    // calLandmarks is derived from calib; listing calib keeps the deps exact.
  }, [labelsOn, cal, calib, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- map clicks: placing a marker or calibrating ----
  clickRef.current = (px, py) => {
    if (!cal) return;
    if (calib) {
      if (!calib.pa) setCalib({ ...calib, pa: { px, py }, error: undefined });
      else if (!calib.pb) {
        const a = LOCATIONS.find((l) => l.name === calib.a)!;
        const b = LOCATIONS.find((l) => l.name === calib.b)!;
        const r = solveCalibration({ ...a, ...calib.pa }, { ...b, px, py });
        setCalib(typeof r === 'string' ? { ...calib, pa: undefined, error: r } : { ...calib, pb: { px, py }, result: r });
      }
      return;
    }
    if (placingId) {
      const u = toUnits(px, py, cal);
      actions.setCoordOverride(placingId, { x: Math.round(u.x * 10) / 10, y: Math.round(u.y * 10) / 10 });
      onSelect(placingId);
      setPlacingId(undefined);
    }
  };

  const centerOn = useCallback(
    (id: string) => {
      const e = ENTRY_BY_ID.get(id);
      const c = e && entryCoords(e, settings);
      if (!c || !cal || !mapRef.current) return;
      const { px, py } = toPixels(c, cal);
      mapRef.current.setView([-py, px], Math.max(mapRef.current.getZoom(), FOCUS_ZOOM));
    },
    [settings, cal],
  );

  // ---- arriving from "show on map" ----
  useEffect(() => {
    if (!focus || !mapReady) return;
    if (focus.place) setPlacingId(focus.id);
    else centerOn(focus.id);
    onSelect(focus.id);
    onFocusHandled();
  }, [focus, mapReady, centerOn, onSelect, onFocusHandled]);

  // ---- keys: Enter toggles the selected entry, Esc cancels modes ----
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (isTyping(ev.target)) return;
      if (ev.key === 'Escape') {
        setPlacingId(undefined);
        setCalib(null);
      } else if (ev.key === 'Enter' && selectedId && !(ev.target instanceof HTMLButtonElement)) {
        actions.toggleDone(selectedId);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId]);

  const selected = selectedId ? ENTRY_BY_ID.get(selectedId) : undefined;
  const placing = placingId ? ENTRY_BY_ID.get(placingId) : undefined;
  const sortedLocs = useMemo(() => [...LOCATIONS].sort((a, b) => a.name.localeCompare(b.name)), []);
  const catCount = (c: Category) => mapEntries.filter((e) => e.category === c).length;

  return (
    <div className="map-screen">
      <div className="map-wrap">
        <div ref={elRef} className={`map${placing || calib ? ' crosshair' : ''}${settings.colourMarkers ? '' : ' mono'}`} />
        {img && !img.url && (
          <div className="map-banner">
            NO MAP IMAGE: add public/{MAP_IMAGE} to see the Commonwealth map. Showing a grid with named locations.
          </div>
        )}
        {placing && (
          <div className="map-banner">
            CLICK THE MAP TO PLACE “{placing.name}” · <button onClick={() => setPlacingId(undefined)}>CANCEL (ESC)</button>
          </div>
        )}
      </div>

      <aside className="map-side">
        {calib ? (
          <section className="calib">
            <h3>CALIBRATE MAP</h3>
            <p className="small dim">
              Pick two landmarks far apart (ideally opposite corners), then click exactly where each one is on your map image.
            </p>
            <label className="field">
              <span>LANDMARK A</span>
              <select value={calib.a} onChange={(ev) => setCalib({ ...calib, a: ev.target.value, pa: undefined, pb: undefined, result: undefined })}>
                {sortedLocs.map((l) => (
                  <option key={l.name}>{l.name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>LANDMARK B</span>
              <select value={calib.b} onChange={(ev) => setCalib({ ...calib, b: ev.target.value, pb: undefined, result: undefined })}>
                {sortedLocs.map((l) => (
                  <option key={l.name}>{l.name}</option>
                ))}
              </select>
            </label>
            <p className="calib-step">
              {!calib.pa && <>▶ Click on <b>{calib.a}</b> on the map.</>}
              {calib.pa && !calib.pb && <>▶ Now click on <b>{calib.b}</b>.</>}
              {calib.result && <>Preview applied. Check that the location dots line up with the map.</>}
            </p>
            {calib.error && <p className="calib-error">{calib.error}</p>}
            <div className="row-buttons">
              <button
                disabled={!calib.result}
                onClick={() => {
                  actions.setCalibration(calib.result);
                  setCalib(null);
                }}
              >
                SAVE
              </button>
              <button onClick={() => setCalib({ a: calib.a, b: calib.b })}>RETRY</button>
              <button onClick={() => setCalib(null)}>CANCEL</button>
            </div>
            {settings.calibration && (
              <button
                className="small-btn"
                onClick={() => {
                  actions.setCalibration(undefined);
                  setCalib(null);
                }}
              >
                RESET TO DEFAULT (IMAGE = WHOLE MAP)
              </button>
            )}
          </section>
        ) : (
          <>
            <section className="map-filters">
              <div className="cat-grid">
                {ALL_CATEGORIES.map((c) => (
                  <label key={c} className="check">
                    <input
                      type="checkbox"
                      checked={cats.has(c)}
                      onChange={() =>
                        setCats((s) => {
                          const n = new Set(s);
                          if (n.has(c)) n.delete(c);
                          else n.add(c);
                          return n;
                        })
                      }
                    />
                    <span
                      className="legend"
                      dangerouslySetInnerHTML={{ __html: markerSvg(c, settings.colourMarkers ? CATEGORY_COLOURS[c] : 'currentColor', 14) }}
                    />
                    {CATEGORY_LABELS[c].toUpperCase()} <span className="dim">{catCount(c)}</span>
                  </label>
                ))}
              </div>
              <div className="row-buttons">
                <select aria-label="Status" value={status} onChange={(ev) => setStatus(ev.target.value as StatusFilter)}>
                  <option value="all">ALL</option>
                  <option value="todo">NOT DONE</option>
                  <option value="done">DONE</option>
                </select>
                <label className="check">
                  <input type="checkbox" checked={showLabels} onChange={(ev) => setShowLabels(ev.target.checked)} />
                  LOCATIONS
                </label>
                <button
                  onClick={() => {
                    const [a, b] = defaultLandmarks();
                    setCalib({ a, b });
                  }}
                >
                  CALIBRATE
                </button>
              </div>
              <p className="small dim">
                {shown.length} on map · {noCoords} without coordinates (use PLACE ON MAP in their details)
              </p>
            </section>

            {groupIds && (
              <section className="group-pick">
                <h3>AT THIS SPOT</h3>
                <ul className="entry-list">
                  {groupIds.map((id) => {
                    const e = ENTRY_BY_ID.get(id)!;
                    return (
                      <li
                        key={id}
                        className={['entry-row', id === selectedId ? 'selected' : '', profile.done[id] ? 'done' : ''].join(' ')}
                        onClick={() => onSelect(id)}
                      >
                        <span className={profile.done[id] ? 'box checked' : 'box'} />
                        <span className="row-name">{e.name}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {selected && (
              <>
                <EntryDetail
                  entry={selected}
                  onShowOnMap={(id) => (entryCoords(selected, settings) ? centerOn(id) : setPlacingId(id))}
                  onJump={onJump}
                />
                <div className="row-buttons map-entry-actions">
                  <button onClick={() => setPlacingId(selected.id)}>MOVE MARKER</button>
                  {settings.coordOverrides[selected.id] && (
                    <button onClick={() => actions.setCoordOverride(selected.id, undefined)}>RESET MARKER</button>
                  )}
                  <button onClick={() => onJump(selected.id)}>OPEN IN LIST</button>
                </div>
              </>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
