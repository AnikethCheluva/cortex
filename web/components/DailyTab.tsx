"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { DailyNote } from "@/lib/types";
import { todayStem } from "@/lib/day";
import { DayEditor } from "./DayEditor";
import { QuizSection } from "./QuizSection";
import { DayQuiz } from "./DayQuiz";
import { Icon } from "./Icon";

type Focus = { id: string; n: number } | null;
export function DailyTab({
  notes,
  focus,
  compact = false,
}: {
  notes: DailyNote[];
  focus?: Focus;
  compact?: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [date, setDate] = useState("");
  const [limit, setLimit] = useState(40);
  const [scrub, setScrub] = useState<number | null>(null);
  const [recallOpen, setRecallOpen] = useState(false);
  const search = useDeferredValue(query.trim().toLowerCase());
  const ordered = useMemo(
    () => [...notes].sort((a, b) => b.date.localeCompare(a.date)),
    [notes],
  );
  const indexed = useMemo(
    () =>
      ordered.map((note) => ({
        note,
        text: `${note.label} ${note.date} ${note.body}`.toLowerCase(),
      })),
    [ordered],
  );
  const filtered = useMemo(
    () =>
      indexed
        .filter(
          ({ note, text }) =>
            (!date || note.date === date) &&
            search.split(/\s+/).every((term) => text.includes(term)),
        )
        .map(({ note }) => note),
    [indexed, search, date],
  );
  useEffect(() => {
    if (focus) setSelected(focus.id);
  }, [focus]);
  useEffect(() => {
    setLimit(40);
  }, [search, date]);
  const open = (file: string) => {
    setScrub(null);
    setSelected(file);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const index = ordered.findIndex((n) => n.file === selected);
  const selectedNote = ordered[index];
  const previewNote =
    scrub === null ? selectedNote : ordered[ordered.length - 1 - scrub];
  const commitScrub = (value: string) =>
    open(ordered[ordered.length - 1 - Number(value)].file);
  return (
    <section className="daily-workspace">
      {selected ? (
        <>
          <div className="daily-scrubber">
            <div className="daily-scrubber-actions">
              <button className="btn" onClick={() => setSelected(null)}>
                All notes
              </button>
              <button
                className="icon-button"
                aria-label="Older note"
                disabled={index < 0 || index >= ordered.length - 1}
                onClick={() => open(ordered[index + 1].file)}
              >
                <Icon name="chevron" style={{ transform: "rotate(180deg)" }} />
              </button>
              <span>{previewNote?.label ?? selected}</span>
              <button
                className="icon-button"
                aria-label="Newer note"
                disabled={index <= 0}
                onClick={() => open(ordered[index - 1].file)}
              >
                <Icon name="chevron" />
              </button>
            </div>
            {index >= 0 && ordered.length > 1 && (
              <label className="daily-range">
                <span>Older</span>
                <input
                  type="range"
                  aria-label="Scrub daily notes"
                  aria-valuetext={previewNote.label}
                  min={0}
                  max={ordered.length - 1}
                  value={scrub ?? ordered.length - 1 - index}
                  onChange={(e) => setScrub(Number(e.target.value))}
                  onPointerUp={(e) => commitScrub(e.currentTarget.value)}
                  onKeyUp={(e) => commitScrub(e.currentTarget.value)}
                  onBlur={(e) => {
                    if (scrub !== null) commitScrub(e.currentTarget.value);
                  }}
                />
                <span>Latest</span>
              </label>
            )}
          </div>
          <DayEditor key={selected} stem={selected} compact={compact} />
          <details
            className="capture-recall"
            onToggle={(event) => setRecallOpen(event.currentTarget.open)}
          >
            <summary>Daily recall</summary>
            {recallOpen &&
              (selected === todayStem() ? (
                <QuizSection />
              ) : (
                <DayQuiz stem={selected} />
              ))}
          </details>
        </>
      ) : (
        <>
          <div className="page-heading archive-heading">
            <div>
              <h1>Daily notes</h1>
            </div>
            <span className="library-count">{notes.length} notes</span>
          </div>
          <div className="archive-search-bar">
            <label className="workspace-search">
              <Icon name="search" />
              <input
                type="search"
                aria-label="Search daily notes"
                placeholder="Search notes…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <label className="archive-date-filter">
              <span>Jump to date</span>
              <input
                type="date"
                aria-label="Filter notes by date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            {(query || date) && (
              <button
                className="quiet-button"
                onClick={() => {
                  setQuery("");
                  setDate("");
                }}
              >
                Clear filters
              </button>
            )}
          </div>
          <p className="archive-result-count" role="status">
            {filtered.length} {filtered.length === 1 ? "note" : "notes"}
            {search || date ? " found" : " · newest first"}
          </p>
          <div className="daily-note-list">
            {filtered.slice(0, limit).map((note) => (
              <button
                className="daily-note-card"
                key={note.file}
                onClick={() => open(note.file)}
              >
                <span className="daily-note-date">{note.label}</span>
                <span className="daily-note-preview">
                  {note.preview || "Open this day’s note"}
                </span>
                <Icon name="chevron" size={16} />
              </button>
            ))}
          </div>
          {!filtered.length && (
            <div className="workspace-empty">
              <h3>No notes found</h3>
              <p>Try another date or search.</p>
            </div>
          )}
          {filtered.length > limit && (
            <button
              className="btn load-more"
              onClick={() => setLimit((n) => n + 40)}
            >
              Show more notes
            </button>
          )}
        </>
      )}
    </section>
  );
}
