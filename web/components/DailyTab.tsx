"use client";

import { useEffect, useMemo, useState } from "react";
import type { DailyNote } from "@/lib/types";
import { todayISO, todayStem } from "@/lib/day";
import { currentStreak } from "@/lib/stats";
import { DayEditor } from "./DayEditor";
import { QuizSection } from "./QuizSection";
import { DayQuiz } from "./DayQuiz";

type Focus = { id: string; n: number } | null;

// The daily-notes archive: every note in sources/daily/. Pick one to read or
// edit it in the same editor the Today tab uses (one source of truth on disk).
export function DailyTab({ notes, focus }: { notes: DailyNote[]; focus?: Focus }) {
  const [selected, setSelected] = useState<string | null>(null);

  // Deep-link from the command palette / Overview (focus.n changes each time so
  // the same note can be reopened).
  useEffect(() => {
    if (focus) setSelected(focus.id);
  }, [focus]);

  const streak = useMemo(
    () => currentStreak(new Set(notes.map((n) => n.date).filter(Boolean)), todayISO()),
    [notes],
  );

  if (selected) {
    // notes are sorted newest-first, so idx-1 is the newer day, idx+1 the older.
    const idx = notes.findIndex((n) => n.file === selected);
    const newer = idx > 0 ? notes[idx - 1] : null;
    const older = idx >= 0 && idx < notes.length - 1 ? notes[idx + 1] : null;
    return (
      <div>
        <div className="daily-nav">
          <button className="btn small" onClick={() => setSelected(null)}>
            ← All notes
          </button>
          <span className="daily-nav-spacer" />
          <button
            className="btn small"
            disabled={!older}
            onClick={() => older && setSelected(older.file)}
            title={older?.label}
          >
            ‹ Older
          </button>
          <button
            className="btn small"
            disabled={!newer}
            onClick={() => newer && setSelected(newer.file)}
            title={newer?.label}
          >
            Newer ›
          </button>
        </div>
        <DayEditor stem={selected} />
        {/* the day's recall quiz: interactive if it's today, else read-only review */}
        {selected === todayStem() ? <QuizSection /> : <DayQuiz stem={selected} />}
      </div>
    );
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 className="section">Daily notes</h2>
        <span className="muted daily-stat">
          {streak > 0 && (
            <>
              <span className="streak-n">{streak}</span>
              -day streak&nbsp;·&nbsp;
            </>
          )}
          {notes.length} notes
        </span>
      </div>
      {notes.length === 0 ? (
        <div className="empty">No daily notes found.</div>
      ) : (
        notes.map((n) => (
          <div
            key={n.file}
            className="daily-row"
            onClick={() => setSelected(n.file)}
          >
            <span className="d-date">{n.label}</span>
            <span className="d-preview">{n.preview}</span>
          </div>
        ))
      )}
    </div>
  );
}
