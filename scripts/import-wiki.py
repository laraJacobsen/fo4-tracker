"""Import Fallout 4 magazines and quests from the Fallout Wiki.

Downloads the wiki's "Fallout 4 magazines" and "Fallout 4 quests" overview
pages (wikitext via the MediaWiki API), parses their tables, and updates
src/data/magazines.json and src/data/quests.json.

Re-running is safe: entries already in the JSON files are kept as-is (so hand
edits survive) and only entries missing from them are added. Delete an entry
(or the whole file's contents) to have it regenerated.

Only base-game content is imported: add-on (DLC) and Creation Club entries are
skipped. Coordinates come from src/data/locations.json
and point at the location as a whole (coordsApprox).

usage: npm run data:wiki      (or: python3 scripts/import-wiki.py)
"""
import json, re, sys, urllib.parse, urllib.request
from pathlib import Path

data_dir = Path(__file__).resolve().parent.parent / 'src' / 'data'

API = 'https://fallout.fandom.com/api.php'
WIKI = 'https://fallout.fandom.com/wiki/'

def wikitext(page):
    q = urllib.parse.urlencode({'action': 'parse', 'page': page, 'prop': 'wikitext',
                                'format': 'json', 'formatversion': 2})
    req = urllib.request.Request(f'{API}?{q}', headers={'User-Agent': 'fo4-tracker-data-import'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)['parse']['wikitext']

def link_targets(s):
    return [m.split('|')[0].strip() for m in re.findall(r'\[\[([^\]]+)\]\]', s)]

def clean(s):
    s = re.sub(r'<ref[^>]*/>|<ref[^>]*>.*?</ref>', '', s, flags=re.S)
    s = re.sub(r'\[\[File:[^\]]*\]\]', '', s)
    s = re.sub(r'\[\[(?:[^\]|]*\|)?([^\]]*)\]\]', r'\1', s)
    s = re.sub(r'\[https?://\S+ ([^\]]*)\]', r'\1', s)
    s = re.sub(r'\{\{[^{}]*\}\}', '', s)
    s = re.sub(r'<br\s*/?>', '\n', s)
    s = re.sub(r'<[^>]+>', '', s)
    s = s.replace("'''", '').replace("''", '')
    lines = [re.sub(r'\s+', ' ', l).strip() for l in s.split('\n')]
    return '\n'.join(l for l in lines if l)

def strip_attrs(cell):
    # "style=... | content" -> content (but not inside [[a|b]])
    m = re.match(r'^\s*((?:style|rowspan|colspan|class|align|data-[a-z-]+)\s*=[^|\[]*)\|(?!\|)(.*)$', cell, re.S)
    return m.group(2) if m else cell

def rows(table):
    """Split one {| ... |} table into rows of raw cell strings."""
    body = table.split('\n|-', 1)[1] if '\n|-' in table else ''
    out = []
    for chunk in re.split(r'\n\|-[^\n]*', '\n|-' + body):
        cells, cur = [], None
        for line in chunk.split('\n'):
            if line.startswith('|}'):
                break
            if line.startswith('|') and not line.startswith('|-'):
                if cur is not None:
                    cells.append(cur)
                parts = line[1:].split('||')
                for p in parts[:-1]:
                    cells.append(p)
                cur = parts[-1]
            elif line.startswith('!'):
                continue
            elif cur is not None:
                cur += '\n' + line
        if cur is not None:
            cells.append(cur)
        cells = [strip_attrs(c).strip() for c in cells]
        if cells:
            out.append(cells)
    return out

def slug(s):
    s = s.lower().replace('&', 'and').replace("'", '').replace('’', '')
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')

# ---- locations ----
locs = json.loads((data_dir / 'locations.json').read_text())
def norm(s):
    return re.sub(r'[^a-z0-9]', '', s.lower().replace('poseiden', 'poseidon'))

loc_by_name = {norm(l['name']): l for l in locs}
# Interiors/sub-areas that aren't in the gazetteer -> their parent map location.
ALIASES = {norm(k): norm(v) for k, v in {
    'Diamond City schoolhouse': 'Diamond City',
    'Valentine Detective Agency': 'Diamond City',
    'Memory Den': 'Goodneighbor',
    'College Square station': 'College Square',
}.items()}

def find_loc(targets):
    for t in targets:
        t = t.split('#')[0]
        for cand in (t, re.sub(r'\s*\((?:location|Fallout 4|Far Harbor|Nuka-World|quest)\)$', '', t, flags=re.I)):
            k = norm(cand)
            l = loc_by_name.get(k) or loc_by_name.get(ALIASES.get(k, ''))
            if l:
                return l
    return None

def coords_of(l):
    return {'x': l['x'], 'y': l['y']}

unmatched = set()

# ---- magazines ----
def build_magazines(existing):
    w = wikitext('Fallout_4_magazines')
    sec = w[w.index('==Location list=='):]
    table = sec[sec.index('{|'):sec.index('|}') + 2]
    out, seen = [], {}
    keep = {e['id']: e for e in existing}
    for cells in rows(table):
        if len(cells) < 5:
            print('skip mag row', cells, file=sys.stderr); continue
        title_raw, issue_raw, loc_raw, where_raw, effect_raw = cells[:5]
        # {{Icon|FO4CC}} Creation Club, {{Icon|FO4FH}} Far Harbor, {{Icon|FO4NW}} Nuka-World
        if any(tag in c for c in cells[:2] for tag in ('FO4CC', 'FO4FH', 'FO4NW')):
            continue
        title = clean(title_raw)
        issue_txt = clean(issue_raw)
        m = re.match(r'#?\s*(\d+)\s*[,:.\-–]?\s*(.*)', issue_txt)
        issue, subtitle = (int(m.group(1)), m.group(2).strip()) if m else (1, issue_txt)
        location = clean(loc_raw).replace('\n', ', ')
        l = find_loc(link_targets(loc_raw) + location.split(', '))
        if not l:
            unmatched.add(location)
        base_id = f'mag-{slug(title)}-{issue:02d}'
        n = seen.get(base_id, 0) + 1; seen[base_id] = n
        mid = base_id if n == 1 else f'{base_id}-{n}'
        if mid in keep:
            out.append(keep.pop(mid)); continue
        e = {
            'id': mid,
            'name': f'{title} #{issue}' + (f': {subtitle}' if subtitle else ''),
            'category': 'magazine',
            'title': title,
            'issue': issue,
            'location': location,
            'where': clean(where_raw).replace('\n', ' '),
            'effect': clean(effect_raw).replace('\n', ' '),
        }
        if l:
            e['coords'] = coords_of(l); e['coordsApprox'] = True
        e['verified'] = True
        e['source'] = WIKI + 'Fallout_4_magazines'
        out.append(e)
    for e in keep.values():
        print('existing magazine not on wiki list, kept:', e['id'], file=sys.stderr)
        out.append(e)
    return out

# ---- quests ----
FACTIONS = {'Minutemen': 'minutemen', 'Brotherhood': 'brotherhood', 'Railroad': 'railroad', 'Institute': 'institute'}

def build_quests(existing):
    w = wikitext('Fallout_4_quests')
    w = w[:w.index('==Notes==')]
    h2 = h3 = h4 = ''
    out = []
    keep = {e['id']: e for e in existing}
    names_seen = set()
    for m in re.finditer(r'^(={2,4})\s*(.*?)\s*\1\s*$|^\{\|', w, re.M):
        if m.group(1):
            lvl, title = len(m.group(1)), clean(m.group(2))
            if lvl == 2: h2, h3, h4 = title, '', ''
            elif lvl == 3: h3, h4 = title, ''
            else: h4 = title
            continue
        if h2 == 'Add-on quests':
            continue
        start = m.start(); end = w.index('\n|}', start) + 3
        table = w[start:end]
        faction = None
        if h2 == 'Faction quests':
            faction = next(v for k, v in FACTIONS.items() if k in h3)
        sub = (h4 or h3).lower()
        if h2 == 'Main quests':
            qtype = 'main'
        elif 'main' in sub and faction:
            qtype = 'faction'
        elif any(k in sub for k in ('radiant', 'repeatable', 'miscellaneous')):
            qtype = 'misc'
        else:
            qtype = 'side'
        for cells in rows(table):
            if len(cells) < 5:
                print('skip quest row', h3, h4, cells, file=sys.stderr); continue
            _, name_raw, loc_raw, giver_raw, reward_raw = cells[:5]
            name = clean(name_raw).split('\n')[0]
            if not name:
                continue
            qid = f'quest-{slug(name)}'
            if qid in names_seen:
                # same quest listed twice (e.g. shared between factions); keep first
                continue
            names_seen.add(qid)
            if qid in keep:
                out.append(keep.pop(qid)); continue
            locs_txt = [x for x in clean(loc_raw).split('\n') if x]
            l = find_loc(link_targets(loc_raw) + [p for x in locs_txt for p in x.split(', ')])
            if not l and locs_txt:
                unmatched.add(locs_txt[0])
            target = (link_targets(name_raw) or [name])[0]
            e = {
                'id': qid,
                'name': name,
                'category': 'quest',
                'questType': qtype,
                'location': locs_txt[0] if locs_txt else 'Various',
                'where': 'Quest locations: ' + (', '.join(locs_txt) if locs_txt else 'various'),
            }
            if l:
                e['coords'] = coords_of(l); e['coordsApprox'] = True
            giver = clean(giver_raw).replace('\n', ' or ')
            if giver: e['giver'] = giver
            reward = clean(reward_raw).replace('\n', ', ')
            if reward: e['reward'] = reward
            if faction: e['faction'] = faction
            e['verified'] = True
            e['source'] = WIKI + target.replace(' ', '_')
            out.append(e)
    for e in keep.values():
        print('existing quest not on wiki list, kept:', e['id'], file=sys.stderr)
        out.append(e)
    return out

def load(name):
    return json.loads((data_dir / name).read_text())

def save(name, entries):
    (data_dir / name).write_text(json.dumps(entries, indent=2, ensure_ascii=False) + '\n')

old_mags, old_quests = load('magazines.json'), load('quests.json')
mags = build_magazines(old_mags)
quests = build_quests(old_quests)
save('magazines.json', mags)
save('quests.json', quests)

print(f'magazines: {len(mags)} ({len(mags) - len(old_mags)} added)')
print(f'quests: {len(quests)} ({len(quests) - len(old_quests)} added)')
print('without coords: magazines', sum('coords' not in m for m in mags), '/ quests', sum('coords' not in q for q in quests))
if unmatched:
    print('locations not in locations.json:', ', '.join(sorted(unmatched)))
