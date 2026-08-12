// Pure helpers over the wiki page set: [[wikilink]] extraction and backlinks.
// Shared by the Wiki tab so a page can show what links to it. The slug
// normalization matches lib/markdown.tsx so links resolve to the same targets.
import type { WikiPage } from "./types";

/** Normalize a [[target]] to a page slug, or null if it points outside the
 *  page set (a path like ../../sources/foo). */
export function linkToSlug(target: string): string | null {
  const t = target.trim();
  if (!t || t.includes("/")) return null;
  return t
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Distinct page slugs a body links to via [[...]] / [[...|label]]. */
export function extractLinks(body: string): string[] {
  const out = new Set<string>();
  const re = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const s = linkToSlug(m[1]);
    if (s) out.add(s);
  }
  return [...out];
}

export type Backlink = { slug: string; title: string };

/** slug → pages that link to it (only links resolving to a real page). */
export function computeBacklinks(pages: WikiPage[]): Map<string, Backlink[]> {
  const exists = new Set(pages.map((p) => p.slug));
  const back = new Map<string, Backlink[]>();
  for (const p of pages) {
    for (const target of extractLinks(p.body)) {
      if (target === p.slug || !exists.has(target)) continue;
      const arr = back.get(target) ?? [];
      if (!arr.some((b) => b.slug === p.slug)) {
        arr.push({ slug: p.slug, title: p.title });
      }
      back.set(target, arr);
    }
  }
  for (const arr of back.values()) arr.sort((a, b) => a.title.localeCompare(b.title));
  return back;
}
