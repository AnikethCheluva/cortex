"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMobile } from "@/lib/useMobile";
import type { WikiPage } from "@/lib/types";
import { Markdown } from "@/lib/markdown";
import {
  wikiFolder,
  WIKI_FOLDER_ORDER,
  type WikiFolder,
} from "@/lib/categories";
import { computeBacklinks } from "@/lib/wiki";
import { useAgentPins } from "@/lib/agent-pins";
import { Icon } from "./Icon";

export function WikiTab({
  pages,
  slug,
  setSlug,
  compact = false,
}: {
  pages: WikiPage[];
  slug: string | null;
  setSlug: (s: string | null) => void;
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const { pins, toggle: togglePin } = useAgentPins();
  const indexScroll = useRef(0);
  const scrollFrame = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (scrollFrame.current !== null)
        cancelAnimationFrame(scrollFrame.current);
    },
    [],
  );
  function navigate(next: string | null) {
    if (next && !slug) indexScroll.current = window.scrollY;
    setSlug(next);
    if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = requestAnimationFrame(() =>
      window.scrollTo({
        top: next ? 0 : indexScroll.current,
        behavior: "instant",
      }),
    );
  }

  const backlinks = useMemo(() => computeBacklinks(pages), [pages]);
  const page = useMemo(
    () => (slug ? (pages.find((p) => p.slug === slug) ?? null) : null),
    [pages, slug],
  );

  function filterByTag(tag: string) {
    setActiveTag(tag);
    setQuery("");
    navigate(null);
  }

  // ---- single page view ----
  function reader() {
    const links = backlinks.get(slug ?? "") ?? [];
    return (
      <div>
        <button className="btn small wiki-back" onClick={() => navigate(null)}>
          ← All pages
        </button>
        {!page ? (
          <div className="empty">No page “{slug}”.</div>
        ) : (
          <>
            <div className="wiki-reader-heading">
              <h2 className="section">{page.title}</h2>
              <button className={`btn small ${pins.includes(page.slug) ? "active" : ""}`} onClick={() => togglePin(page.slug)}>
                <Icon name="agent" size={15} /> {pins.includes(page.slug) ? "Pinned to Agent" : "Pin to Agent"}
              </button>
            </div>
            <div className="wiki-meta">
              {(page.tags ?? []).map((t) => (
                <button
                  key={t}
                  className="tag tag-btn"
                  onClick={() => filterByTag(t)}
                >
                  #{t}
                </button>
              ))}
              {page.updated && <span>updated {page.updated}</span>}
            </div>
            <Markdown body={page.body} onNavigate={navigate} />
            {page.sources && page.sources.length > 0 && (
              <div className="wiki-meta" style={{ marginTop: 18 }}>
                Sources:{" "}
                {page.sources
                  .map((s) =>
                    s
                      .replace(/\[\[|\]\]/g, "")
                      .split("/")
                      .pop(),
                  )
                  .join(", ")}
              </div>
            )}
            {links.length > 0 && (
              <div className="backlinks">
                <div className="backlinks-label">Linked from</div>
                {links.map((b) => (
                  <button
                    key={b.slug}
                    className="backlink"
                    onClick={() => navigate(b.slug)}
                  >
                    {b.title}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <section className="wiki-workspace">
      {slug && reader()}
      <div hidden={!!slug}>
        <WikiIndex
          pages={pages}
          setSlug={navigate}
          compact={compact}
          visible={!slug}
          query={query}
          setQuery={setQuery}
          activeTag={activeTag}
          setActiveTag={setActiveTag}
        />
      </div>
    </section>
  );
}

// ---- folder / filtered index ----
function WikiIndex({
  pages,
  setSlug,
  query,
  setQuery,
  activeTag,
  setActiveTag,
  compact,
  visible,
}: {
  pages: WikiPage[];
  setSlug: (s: string) => void;
  query: string;
  setQuery: (q: string) => void;
  activeTag: string | null;
  setActiveTag: (t: string | null) => void;
  compact: boolean;
  visible: boolean;
}) {
  const filtering = query.trim().length > 0 || activeTag !== null;
  // "curated" = grouped into type-tag folders; "all" = a flat A–Z index of every
  // page, so you can surf everything regardless of how it's tagged.
  const [view, setView] = useState<"curated" | "all">("curated");
  const search = useDeferredValue(query.trim().toLowerCase());
  const [limit, setLimit] = useState(40);
  const indexed = useMemo(
    () =>
      pages.map((page) => ({
        page,
        text: `${page.title} ${page.summary} ${page.tags.join(" ")} ${page.body}`.toLowerCase(),
      })),
    [pages],
  );
  useEffect(() => {
    setLimit(40);
  }, [search, activeTag, view]);

  const filtered = useMemo(() => {
    const terms = search.split(/\s+/).filter(Boolean);
    return indexed
      .filter(
        ({ page, text }) =>
          (!activeTag || page.tags.includes(activeTag)) &&
          terms.every((term) => text.includes(term)),
      )
      .map(({ page }) => page)
      .sort(
        (a, b) =>
          Number(b.title.toLowerCase().includes(search)) -
            Number(a.title.toLowerCase().includes(search)) ||
          a.title.localeCompare(b.title),
      );
  }, [indexed, search, activeTag]);

  const folders = useMemo(() => {
    const byKey = new Map<string, { folder: WikiFolder; pages: WikiPage[] }>();
    for (const p of pages) {
      const f = wikiFolder(p.tags ?? []);
      const entry = byKey.get(f.key) ?? { folder: f, pages: [] };
      entry.pages.push(p);
      byKey.set(f.key, entry);
    }
    for (const e of byKey.values())
      e.pages.sort((a, b) => a.title.localeCompare(b.title));
    return [...byKey.values()].sort(
      (a, b) =>
        WIKI_FOLDER_ORDER.indexOf(a.folder.key) -
        WIKI_FOLDER_ORDER.indexOf(b.folder.key),
    );
  }, [pages]);

  const [open, setOpen] = useState<Record<string, boolean>>({});

  const mobile = useMobile();
  const [headerHost, setHeaderHost] = useState<HTMLElement | null>(null);
  useEffect(() => { setHeaderHost(mobile ? document.getElementById("workspace-phone-actions") : null); }, [mobile]);
  const selector = <label className="wiki-header-selector"><span className="sr-only">Wiki view</span><select aria-label="Wiki view" value={view} onChange={event => setView(event.target.value as "curated" | "all")}><option value="curated">Curated</option><option value="all">All pages</option></select></label>;
  return (
    <div>
      {headerHost && visible && createPortal(selector, headerHost)}
      <div className="page-heading wiki-index-heading">
        {!mobile && selector}
        <h1>Wiki</h1>
        <span className="wiki-page-count">{pages.length} {pages.length === 1 ? "page" : "pages"}</span>
      </div>
      {activeTag && <button className="tag tag-btn active" onClick={() => setActiveTag(null)}>#{activeTag} ✕</button>}

      {pages.length === 0 ? (
        <div className="empty">No wiki pages found in wiki/pages/.</div>
      ) : filtering ? (
        filtered.length === 0 ? (
          <div className="empty">No pages match.</div>
        ) : (
          <>
            <div className="muted" style={{ marginBottom: 8 }}>
              {filtered.length} {filtered.length === 1 ? "page" : "pages"}
            </div>
            {filtered.slice(0, limit).map((p) => (
              <PageCard key={p.slug} page={p} onOpen={() => setSlug(p.slug)} />
            ))}
            {filtered.length > limit && (
              <button
                className="btn load-more"
                onClick={() => setLimit((n) => n + 40)}
              >
                Show more results
              </button>
            )}
          </>
        )
      ) : view === "all" ? (
        <>
          <AllPages pages={filtered.slice(0, limit)} setSlug={setSlug} />
          {filtered.length > limit && (
            <button
              className="btn load-more"
              onClick={() => setLimit((n) => n + 40)}
            >
              Show more pages
            </button>
          )}
        </>
      ) : (
        folders.map(({ folder, pages: fp }) => {
          const isOpen = open[folder.key] ?? !compact;
          return (
            <div key={folder.key} className="folder">
              <button
                className="folder-head"
                aria-expanded={isOpen}
                onClick={() =>
                  setOpen((o) => ({ ...o, [folder.key]: !isOpen }))
                }
              >
                <span className={`twirl ${isOpen ? "open" : ""}`}>▶</span>
                <span className="folder-name">{folder.label}</span>
                <span className="folder-count">{fp.length}</span>
              </button>
              {isOpen && (
                <div className="folder-body">
                  {fp.map((p) => (
                    <PageCard
                      key={p.slug}
                      page={p}
                      onOpen={() => setSlug(p.slug)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// Flat A–Z index of every page — browse the whole wiki, tag-agnostic.
function AllPages({
  pages,
  setSlug,
}: {
  pages: WikiPage[];
  setSlug: (s: string) => void;
}) {
  const groups = useMemo(() => {
    const sorted = [...pages].sort((a, b) => a.title.localeCompare(b.title));
    const m = new Map<string, WikiPage[]>();
    for (const p of sorted) {
      const first = (p.title.trim()[0] ?? "#").toUpperCase();
      const key = /[A-Z]/.test(first) ? first : "#";
      (m.get(key) ?? m.set(key, []).get(key)!).push(p);
    }
    return [...m.entries()];
  }, [pages]);

  return (
    <>
      <div className="muted" style={{ marginBottom: 8 }}>
        {pages.length} pages · A–Z
      </div>
      {groups.map(([letter, ps]) => (
        <div key={letter} className="alpha-group">
          <div className="alpha-head">{letter}</div>
          {ps.map((p) => (
            <PageCard key={p.slug} page={p} onOpen={() => setSlug(p.slug)} />
          ))}
        </div>
      ))}
    </>
  );
}

function PageCard({ page: p, onOpen }: { page: WikiPage; onOpen: () => void }) {
  return (
    <button className="wiki-card" onClick={onOpen}>
      <span className="wiki-title">{p.title}</span>
      {p.summary && <span className="wiki-summary">{p.summary}</span>}
      <span className="wiki-meta">
        {(p.tags ?? []).slice(0, 6).map((t) => (
          <span key={t} className="tag">
            #{t}
          </span>
        ))}
        {p.updated && <span>updated {p.updated}</span>}
      </span>
    </button>
  );
}
