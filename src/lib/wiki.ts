import type { Entry } from '../types';
import { LOCATIONS } from './loadData';

/**
 * Live walkthrough text from the Fallout Wiki (fallout.fandom.com, CC BY-SA).
 *
 * Pages are fetched through the MediaWiki API, which allows cross-origin
 * requests with `origin=*`. The returned HTML is never inserted as-is: it is
 * reduced to a small tree of whitelisted tags (paragraphs, lists, tables,
 * emphasis, links) that the Walkthrough component renders with React.
 */

const WIKI = 'https://fallout.fandom.com';
const API = `${WIKI}/api.php`;

export type WikiNode =
  | { t: 'text'; v: string }
  | { t: 'el'; tag: AllowedTag; href?: string; span?: number; children: WikiNode[] };

export interface WikiSection {
  title: string;
  /** Expanded by default (walkthrough/layout-type sections). */
  open: boolean;
  nodes: WikiNode[];
}

export interface WikiPage {
  title: string;
  url: string;
  sections: WikiSection[];
}

const ALLOWED = [
  'p', 'ul', 'ol', 'li', 'b', 'strong', 'i', 'em', 'h3', 'h4', 'h5', 'dl', 'dt', 'dd',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'br', 'blockquote', 'code', 'a',
] as const;
export type AllowedTag = (typeof ALLOWED)[number];
const ALLOWED_SET = new Set<string>(ALLOWED);
const TABLE_PARTS = new Set(['table', 'thead', 'tbody', 'tr']);

/** Page furniture that isn't walkthrough content. */
const JUNK = [
  'script', 'style', 'noscript', 'link', 'meta', 'audio', 'video', 'img', 'figure', 'aside',
  '.portable-infobox', '.toc', '#toc', '.mw-editsection', 'sup.reference', '.mw-references-wrap',
  '[class*="navbox"]', '.thumb', '.gallery', '.wikia-gallery', '.hatnote', '.dablink', '.rellink',
  '.printfooter', '.mw-empty-elt', '.va-dirbox', '.hidden',
].join(',');

const HIDDEN_SECTIONS = new Set([
  'appearances', 'behind the scenes', 'gallery', 'references', 'videos', 'sounds',
  'see also', 'external links', 'achievements and trophies', 'contents',
]);

const OPEN_SECTIONS = /walkthrough|layout|notable loot|location|acquisition|solution|overview/i;

/** Overview pages listing many entries: no per-entry detail there. */
const OVERVIEW_PAGES = new Set(['Fallout 4 magazines', 'Fallout 4 quests', 'Vault-Tec bobblehead (Fallout 4)', 'Fallout 4 unique weapons']);

function titleFromUrl(url: string): string | undefined {
  const m = /\/wiki\/([^?#]+)/.exec(url);
  return m ? decodeURIComponent(m[1]).replace(/_/g, ' ') : undefined;
}

/** Wiki pages worth showing for an entry: its own page, then its location's page. */
export function walkthroughPages(e: Entry): string[] {
  const pages: string[] = [];
  const own = e.source ? titleFromUrl(e.source) : undefined;
  if (own && !OVERVIEW_PAGES.has(own)) pages.push(own);
  if (e.category !== 'quest') {
    for (const loc of locationTitles(e.location)) {
      if (!pages.some((p) => p.toLowerCase() === loc.toLowerCase())) pages.push(loc);
    }
  }
  return pages;
}

/**
 * "The Third Rail in Goodneighbor" -> ["The Third Rail", "Goodneighbor"];
 * a plain gazetteer name is used as-is. At most two, most specific first.
 */
function locationTitles(location: string): string[] {
  const exact = LOCATIONS.find((l) => l.name.toLowerCase() === location.toLowerCase());
  if (exact) return [exact.name];
  if (/^(see details|various)$/i.test(location)) return [];
  return location
    .split(/\s+in\s+|\s+near\s+|\s*[/,()*]\s*/)
    .map((s) => s.replace(/^unmarked location$/i, '').trim())
    .filter((s) => s.length > 2)
    .slice(0, 2);
}

function convert(node: Node): WikiNode[] {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ? [{ t: 'text', v: node.textContent }] : [];
  if (node.nodeType !== Node.ELEMENT_NODE) return [];
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  let children = [...el.childNodes].flatMap(convert);
  // Table structure elements may not hold text, not even whitespace.
  if (TABLE_PARTS.has(tag)) children = children.filter((c) => c.t === 'el');
  if (!ALLOWED_SET.has(tag)) return children; // unwrap span/div/etc.
  const out: WikiNode = { t: 'el', tag: tag as AllowedTag, children };
  if (tag === 'a') {
    const href = el.getAttribute('href') ?? '';
    // Only plain article links; anchors, edit links and red links become text.
    if (!href.startsWith('/wiki/') || el.classList.contains('new')) return children;
    out.href = WIKI + href;
  }
  if (tag === 'td' || tag === 'th') {
    const span = Number(el.getAttribute('colspan'));
    if (span > 1) out.span = Math.min(span, 20);
  }
  return [out];
}

function hasText(nodes: WikiNode[]): boolean {
  return nodes.some((n) => (n.t === 'text' ? n.v.trim() !== '' : hasText(n.children)));
}

export function parsePage(title: string, html: string): WikiPage {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const root = doc.querySelector('.mw-parser-output') ?? doc.body;
  root.querySelectorAll(JUNK).forEach((n) => n.remove());

  const sections: WikiSection[] = [];
  let current: WikiSection = { title: 'Overview', open: true, nodes: [] };
  for (const child of [...root.childNodes]) {
    if (child instanceof Element && child.tagName === 'H2') {
      sections.push(current);
      const t = (child.textContent ?? '').replace(/\[\s*\]/g, '').trim();
      current = { title: t, open: OPEN_SECTIONS.test(t), nodes: [] };
    } else {
      current.nodes.push(...convert(child));
    }
  }
  sections.push(current);

  return {
    title,
    url: `${WIKI}/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
    sections: sections.filter((s) => !HIDDEN_SECTIONS.has(s.title.toLowerCase()) && hasText(s.nodes)),
  };
}

const cache = new Map<string, Promise<WikiPage>>();

export function fetchWikiPage(title: string): Promise<WikiPage> {
  let p = cache.get(title);
  if (!p) {
    const q = new URLSearchParams({
      action: 'parse',
      page: title,
      prop: 'text',
      format: 'json',
      formatversion: '2',
      redirects: '1',
      disableeditsection: '1',
      disabletoc: '1',
      origin: '*',
    });
    p = fetch(`${API}?${q}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Wiki returned HTTP ${r.status}`);
        return r.json();
      })
      .then((d: { parse?: { title: string; text: string }; error?: { info: string } }) => {
        if (!d.parse) throw new Error(d.error?.info ?? 'Page not found');
        return parsePage(d.parse.title, d.parse.text);
      });
    p.catch(() => cache.delete(title)); // allow a retry
    cache.set(title, p);
  }
  return p;
}
