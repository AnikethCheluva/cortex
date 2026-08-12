"use client";

import { useMemo, useState } from "react";
import type { WikiPage } from "@/lib/types";
import { Markdown } from "@/lib/markdown";
import { wikiFolder, WIKI_FOLDER_ORDER, type WikiFolder } from "@/lib/categories";
import { computeBacklinks } from "@/lib/wiki";

export function WikiTab({
  pages,
  slug,
  setSlug,
}: {
  pages: WikiPage[];
  slug: string | null;
  setSlug: (s: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const backlinks = useMemo(() => computeBacklinks(pages), [pages]);
  const page = useMemo(
    () => (slug ? pages.find((p) => p.slug === slug) ?? null : null),
    [pages, slug],
  );

  function filterByTag(tag: string) {
    setActiveTag(tag);
    setQuery("");
    setSlug(null);
  }

  // ---- single page view ----
  if (slug) {
    const links = backlinks.get(slug) ?? [];
    return (
      <div>
        <button className="btn small" onClick={() => setSlug(null)}>
          ← All pages
        </button>
        {!page ? (
          <div className="empty">No page “{slug}”.</div>
        ) : (
          <>
            <h2 className="section">{page.title}</h2>
            <div className="wiki-meta">
              {(page.tags ?? []).map((t) => (
                <button key={t} className="tag tag-btn" onClick={() => filterByTag(t)}>
                  #{t}
                </button>
              ))}
              {page.updated && <span>updated {page.updated}</span>}
            </div>
            <Markdown body={page.body} onNavigate={(s) => setSlug(s)} />
            {page.sources && page.sources.length > 0 && (
              <div className="wiki-meta" style={{ marginTop: 18 }}>
                Sources:{" "}
                {page.sources
                  .map((s) => s.replace(/\[\[|\]\]/g, "").split("/").pop())
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
                    onClick={() => setSlug(b.slug)}
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
    <WikiIndex
      pages={pages}
      setSlug={setSlug}
      query={query}
      setQuery={setQuery}
      activeTag={activeTag}
      setActiveTag={setActiveTag}
    />
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
}: {
  pages: WikiPage[];
  setSlug: (s: string) => void;
  query: string;
  setQuery: (q: string) => void;
  activeTag: string | null;
  setActiveTag: (t: string | null) => void;
}) {
  const filtering = query.trim().length > 0 || activeTag !== null;

  const filtered = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return pages
      .filter((p) => (activeTag ? (p.tags ?? []).includes(activeTag) : true))
      .filter((p) => {
        if (!terms.length) return true;
        const hay = `${p.title} ${p.summary} ${(p.tags ?? []).join(" ")} ${p.body}`.toLowerCase();
        return terms.every((t) => hay.includes(t));
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [pages, query, activeTag]);

  const folders = useMemo(() => {
    const byKey = new Map<string, { folder: WikiFolder; pages: WikiPage[] }>();
    for (const p of pages) {
      const f = wikiFolder(p.tags ?? []);
      const entry = byKey.get(f.key) ?? { folder: f, pages: [] };
      entry.pages.push(p);
      byKey.set(f.key, entry);
    }
    for (const e of byKey.values()) e.pages.sort((a, b) => a.title.localeCompare(b.title));
    return [...byKey.values()].sort(
      (a, b) =>
        WIKI_FOLDER_ORDER.indexOf(a.folder.key) - WIKI_FOLDER_ORDER.indexOf(b.folder.key),
    );
  }, [pages]);

  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <div>
      <h2 className="section">Living Wiki</h2>
      <div className="wiki-search">
        <input
          className="wiki-search-input"
          placeholder="Filter pages…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {activeTag && (
          <button className="tag tag-btn active" onClick={() => setActiveTag(null)}>
            #{activeTag} ✕
          </button>
        )}
      </div>

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
            {filtered.map((p) => (
              <PageCard key={p.slug} page={p} onOpen={() => setSlug(p.slug)} />
            ))}
          </>
        )
      ) : (
        folders.map(({ folder, pages: fp }) => {
          const isOpen = open[folder.key] ?? true;
          return (
            <div key={folder.key} className="folder">
              <button
                className="folder-head"
                onClick={() => setOpen((o) => ({ ...o, [folder.key]: !isOpen }))}
              >
                <span className={`twirl ${isOpen ? "open" : ""}`}>▶</span>
                <span className="folder-name">{folder.label}</span>
                <span className="folder-count">{fp.length}</span>
              </button>
              {isOpen && (
                <div className="folder-body">
                  {fp.map((p) => (
                    <PageCard key={p.slug} page={p} onOpen={() => setSlug(p.slug)} />
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

function PageCard({ page: p, onOpen }: { page: WikiPage; onOpen: () => void }) {
  return (
    <div className="wiki-card" onClick={onOpen}>
      <div className="wiki-title">{p.title}</div>
      {p.summary && <div className="wiki-summary">{p.summary}</div>}
      <div className="wiki-meta">
        {(p.tags ?? []).slice(0, 6).map((t) => (
          <span key={t} className="tag">
            #{t}
          </span>
        ))}
        {p.updated && <span>updated {p.updated}</span>}
      </div>
    </div>
  );
}
