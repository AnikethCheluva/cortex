"use client";

import { useEffect, useState } from "react";
import { getQuizDay, type DayQuizCard } from "@/lib/clientapi";

// Read-only review of a past day's recall quiz, shown under the note in the
// Daily tab. Lists the questions that were asked that day; tap one to reveal its
// answer + rubric (it's a historical snapshot, so no re-answering here — that
// happens on the Today tab).
export function DayQuiz({ stem }: { stem: string }) {
  const [cards, setCards] = useState<DayQuizCard[] | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setCards(null);
    setOpen(new Set());
    getQuizDay(stem)
      .then((r) => !cancelled && setCards(r.cards))
      .catch(() => !cancelled && setCards([]));
    return () => {
      cancelled = true;
    };
  }, [stem]);

  if (!cards || cards.length === 0) return null; // no quiz that day → render nothing

  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  return (
    <section className="voice-section">
      <div className="voice-head">
        <h3 className="sub voice-title">Recall quiz</h3>
        <span className="recall-progress">
          {cards.length} question{cards.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="dayquiz">
        {cards.map((c) => {
          const isOpen = open.has(c.id);
          return (
            <div key={c.id} className={`dayquiz-item ${isOpen ? "open" : ""}`}>
              <button className="dayquiz-q" onClick={() => toggle(c.id)}>
                <span className="dayquiz-caret">{isOpen ? "−" : "+"}</span>
                <span className="dayquiz-topic">{c.topic}</span>
                <span className="dayquiz-stem">{c.stem}</span>
              </button>
              {isOpen && (
                <div className="dayquiz-a">
                  <div className="reveal-ref">
                    <span className="reveal-label">Answer</span>
                    {c.referenceAnswer}
                  </div>
                  {c.requiredPoints.length > 0 && (
                    <ul className="reveal-points">
                      {c.requiredPoints.map((p, i) => (
                        <li key={i} className="pt">
                          {p}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="reveal-src">{c.source_file.split("/").pop()}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
