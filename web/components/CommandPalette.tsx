"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { VaultData } from "@/lib/types";
import { searchVault, type SearchResult } from "@/lib/search";
import { isAgentPrompt, isTimeboxCommand } from "@/lib/agent-intent";
import { Markdown } from "@/lib/markdown";
import { Icon } from "./Icon";

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
  onAskAgent,
  onTimeboxTasks,
}: {
  data: VaultData;
  open: boolean;
  onClose: () => void;
  onSelect: (r: SearchResult) => void;
  onAskAgent: (prompt: string) => Promise<string>;
  onTimeboxTasks: () => void;
}) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [response, setResponse] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => searchVault(q, data, 14), [q, data]);
  const agentMode = isAgentPrompt(q);
  const timeboxMode = isTimeboxCommand(q);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      setResponse("");
      setError("");
      // focus after the element paints
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    setResponse("");
    setError("");
  }, [q]);

  if (!open) return null;

  function choose(r: SearchResult | undefined) {
    if (!r) return;
    onSelect(r);
    onClose();
  }
  async function askAgent() {
    if (!q.trim() || sending) return;
    setSending(true);
    setError("");
    setResponse("");
    try {
      setResponse(await onAskAgent(q.trim().replace(/^>\s*/, "")));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  function runTimebox() {
    onTimeboxTasks();
    onClose();
  }

  return (
    <div className="cmdk-overlay" onClick={onClose}>
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="Search or ask Codex" onClick={(e) => e.stopPropagation()}>
        <div className="cmdk-search-row">
          <Icon name={agentMode ? "agent" : "search"} size={18} />
          <input
            ref={inputRef}
            className="cmdk-input"
            placeholder="Search your workspace or ask Codex…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, Math.max(0, results.length - 1)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (timeboxMode) runTimebox();
              else if (agentMode) void askAgent();
              else choose(results[active]);
            } else if (e.key === "Escape") {
              e.preventDefault();
              onClose();
            }
            }}
          />
          {q && <button className="cmdk-clear" type="button" aria-label="Clear query" onClick={() => setQ("")}><Icon name="close" size={14} /></button>}
        </div>
        <div className="cmdk-results">
          {timeboxMode && q && !response && (
            <button className="cmdk-agent-action" onClick={runTimebox}>
              <span className="cmdk-action-icon"><Icon name="clock" size={17} /></span>
              <span>
                <b>Plan tasks on calendar</b>
                <small>Estimate your open tasks and schedule focus blocks</small>
              </span>
              <kbd>↵</kbd>
            </button>
          )}
          {agentMode && !timeboxMode && q && !response && (
            <button
              className="cmdk-agent-action"
              onClick={() => void askAgent()}
              disabled={sending}
            >
              <span className="cmdk-action-icon"><Icon name="agent" size={17} /></span>
              <span>
                <b>{sending ? "Sending to Codex…" : "Ask Codex"}</b>
                <small>{sending ? "Thinking with your Cortex context" : "Get a quick answer without leaving this view"}</small>
              </span>
              <kbd>↵</kbd>
            </button>
          )}
          {response && <div className="cmdk-agent-response"><div className="cmdk-answer-heading"><span className="cmdk-action-icon"><Icon name="agent" size={16} /></span><b>Codex</b></div><Markdown body={response} /></div>}
          {error && <div className="cmdk-agent-error" role="alert"><b>Codex is unavailable</b><span>{error}</span><button type="button" onClick={() => void askAgent()}>Try again</button></div>}
          {q && !agentMode && results.length === 0 && (
            <div className="cmdk-empty">No matches for “{q}”.</div>
          )}
          {!q && (
            <div className="cmdk-empty">
              Search notes and tasks, or write a request to ask Codex.
            </div>
          )}
          {!agentMode && results.map((r, i) => (
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
          <span>↵ {timeboxMode ? "run" : agentMode ? "send" : "open"}</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
