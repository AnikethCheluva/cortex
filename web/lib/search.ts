// Lightweight client-side search over the whole vault (wiki pages, tasks, daily
// notes), powering the ⌘K command palette. No index/library needed — the vault
// is small and already in memory; we just score substring matches with simple
// field weighting and require every query term to hit somewhere in the record.
import type { VaultData } from "./types";

export type SearchKind = "wiki" | "task" | "daily";
export type SearchResult = {
  kind: SearchKind;
  id: string; // wiki slug | task id | daily stem
  title: string;
  subtitle: string;
  score: number;
};

type Field = { text: string; weight: number };

function scoreFields(terms: string[], fields: Field[]): number {
  let total = 0;
  for (const term of terms) {
    let best = 0;
    for (const f of fields) {
      const i = f.text.toLowerCase().indexOf(term);
      if (i >= 0) best = Math.max(best, f.weight + (i === 0 ? f.weight : 0));
    }
    if (best === 0) return 0; // term missing entirely → not a match
    total += best;
  }
  return total;
}

export function searchVault(query: string, data: VaultData, limit = 12): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  const out: SearchResult[] = [];

  for (const p of data.wiki) {
    const s = scoreFields(terms, [
      { text: p.title, weight: 6 },
      { text: p.summary, weight: 2 },
      { text: (p.tags ?? []).join(" "), weight: 3 },
      { text: p.body, weight: 1 },
    ]);
    if (s) out.push({ kind: "wiki", id: p.slug, title: p.title, subtitle: p.summary || "wiki page", score: s });
  }

  for (const t of data.tasks) {
    const s = scoreFields(terms, [
      { text: t.title, weight: 6 },
      { text: t.project, weight: 2 },
      { text: (t.tags ?? []).join(" "), weight: 2 },
      { text: t.body, weight: 1 },
    ]);
    if (s) {
      const status = t.status.replace("_", " ");
      out.push({ kind: "task", id: t.id, title: t.title, subtitle: `${t.project} · ${status}`, score: s });
    }
  }

  for (const n of data.daily) {
    const s = scoreFields(terms, [
      { text: n.label, weight: 4 },
      { text: n.preview, weight: 1 },
      { text: n.body, weight: 1 },
    ]);
    if (s) out.push({ kind: "daily", id: n.file, title: n.label, subtitle: n.preview || "daily note", score: s });
  }

  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}
