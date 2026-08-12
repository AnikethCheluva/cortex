"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { VaultData } from "@/lib/types";
import { searchVault, type SearchResult } from "@/lib/search";

const KIND_LABEL: Record<SearchResult["kind"], string> = {
  wiki: "Wiki",
  task: "Task",
  daily: "Daily",
};

// ⌘K / Ctrl+K global search over the whole vault. Arrow keys to move, Enter to
// open, Esc to close. Selecting a result routes via onSelect (handled upstream).
export function CommandPalette({
  data,
  open,
  onClose,
  onSelect,
}: {
  data: VaultData;
  open: boolean;
  onClose: () => void;
  onSelect: (r: SearchResult) => void;
}) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => searchVault(q, data, 14), [q, data]);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      // focus after the element paints
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => setActive(0), [q]);

  if (!open) return null;

  function choose(r: SearchResult | undefined) {
    if (!r) return;
    onSelect(r);
    onClose();
  }

  return (
    <div className="cmdk-overlay" onClick={onClose}>
      <div className="cmdk" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="cmdk-input"
          placeholder="Search wiki, tasks, daily notes…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              choose(results[active]);
            } else if (e.key === "Escape") {
              e.preventDefault();
              onClose();
            }
          }}
        />
        <div className="cmdk-results">
          {q && results.length === 0 && (
            <div className="cmdk-empty">No matches for “{q}”.</div>
          )}
          {!q && (
            <div className="cmdk-empty">
              Type to search across your wiki, tasks, and daily notes.
            </div>
          )}
          {results.map((r, i) => (
            <button
              key={`${r.kind}:${r.id}`}
              className={`cmdk-item ${i === active ? "active" : ""}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(r)}
            >
              <span className={`cmdk-kind k-${r.kind}`}>{KIND_LABEL[r.kind]}</span>
              <span className="cmdk-title">{r.title}</span>
              <span className="cmdk-sub">{r.subtitle}</span>
            </button>
          ))}
        </div>
        <div className="cmdk-foot">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
