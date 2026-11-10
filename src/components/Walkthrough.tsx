import { createElement, useEffect, useState, type ReactNode } from 'react';
import type { Entry } from '../types';
import { fetchWikiPage, walkthroughPages, type WikiNode, type WikiPage } from '../lib/wiki';

function render(nodes: WikiNode[]): ReactNode[] {
  return nodes.map((n, i) => {
    if (n.t === 'text') return n.v;
    const children = render(n.children);
    if (n.tag === 'a') {
      return (
        <a key={i} href={n.href} target="_blank" rel="noreferrer">
          {children}
        </a>
      );
    }
    if (n.tag === 'br') return <br key={i} />;
    if (n.tag === 'table') {
      return (
        <div key={i} className="wt-table">
          <table>{children}</table>
        </div>
      );
    }
    return createElement(n.tag, { key: i, colSpan: n.span }, ...children);
  });
}

type State = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ok'; page: WikiPage };

function WikiPageView({ title }: { title: string }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setState({ status: 'loading' });
    fetchWikiPage(title).then(
      (page) => live && setState({ status: 'ok', page }),
      (err: Error) => live && setState({ status: 'error', message: err.message }),
    );
    return () => {
      live = false;
    };
  }, [title, attempt]);

  if (state.status === 'loading') return <p className="dim small wt-status">LOADING FROM THE FALLOUT WIKI…</p>;
  if (state.status === 'error') {
    return (
      <p className="small wt-status">
        Could not load “{title}”: {state.message}.{' '}
        <button className="link" onClick={() => setAttempt((a) => a + 1)}>
          Retry
        </button>
      </p>
    );
  }
  const { page } = state;
  return (
    <div className="wt-page">
      {page.sections.map((s) => (
        <details key={s.title} open={s.open} className="wt-section">
          <summary>{s.title.toUpperCase()}</summary>
          <div className="wt-body">{render(s.nodes)}</div>
        </details>
      ))}
      <p className="dim small wt-credit">
        Text from the{' '}
        <a href={page.url} target="_blank" rel="noreferrer">
          Fallout Wiki page “{page.title}”
        </a>{' '}
        (CC BY-SA).
      </p>
    </div>
  );
}

/** Detailed walkthrough for an entry, loaded on demand from the wiki. */
export function Walkthrough({ entry }: { entry: Entry }) {
  const pages = walkthroughPages(entry);
  const [active, setActive] = useState(0);
  const page = pages[Math.min(active, pages.length - 1)];

  if (!page) return <p className="dim small">No wiki page is linked for this entry.</p>;
  return (
    <div className="walkthrough">
      {pages.length > 1 && (
        <div className="wt-tabs" role="tablist">
          {pages.map((p, i) => (
            <button key={p} role="tab" aria-selected={p === page} className={p === page ? 'on' : ''} onClick={() => setActive(i)}>
              {p}
            </button>
          ))}
        </div>
      )}
      <WikiPageView key={page} title={page} />
    </div>
  );
}
