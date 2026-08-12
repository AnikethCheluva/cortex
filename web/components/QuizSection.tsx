"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicCard } from "@/lib/srs/types";
import { getQuizToday, submitAnswer, type QuizReveal } from "@/lib/clientapi";

type Phase = "answer" | "submitting" | "revealed";

// The daily recall quiz, shown under the note on the Today page. Keyless: you
// answer, it reveals the reference answer for self-check, and queues the answer.
// The ingest grades the queue and advances the FSRS schedule + stats.
export function QuizSection() {
  const [queue, setQueue] = useState<PublicCard[] | null>(null);
  const [err, setErr] = useState("");
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<Phase>("answer");
  const [answer, setAnswer] = useState("");
  const [confidence, setConfidence] = useState(0.6);
  const [reveal, setReveal] = useState<QuizReveal | null>(null);
  const [answered, setAnswered] = useState(0);
  const startRef = useRef(0);
  const continueRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(() => {
    setQueue(null);
    setErr("");
    getQuizToday()
      .then((r) => {
        const submitted = new Set(r.submittedIds);
        setQueue(r.cards.filter((c) => !submitted.has(c.id)));
        setAnswered(r.submittedIds.length);
        setI(0);
        setPhase("answer");
        setAnswer("");
        setConfidence(0.6);
        setReveal(null);
        startRef.current = Date.now();
      })
      .catch((e) => setErr((e as Error).message));
  }, []);

  useEffect(() => load(), [load]);
  useEffect(() => {
    if (phase === "revealed") continueRef.current?.focus();
  }, [phase]);

  const card = queue && i < queue.length ? queue[i] : null;
  const finished = queue != null && queue.length > 0 && i >= queue.length;
  const empty = queue != null && queue.length === 0;

  async function submit() {
    if (!card || phase !== "answer") return;
    setPhase("submitting");
    try {
      const r = await submitAnswer({
        cardId: card.id,
        answer,
        confidence,
        durationMs: Date.now() - startRef.current,
      });
      setReveal(r);
      setPhase("revealed");
    } catch (e) {
      setErr((e as Error).message);
      setPhase("answer");
    }
  }

  function next() {
    setAnswered((n) => n + 1);
    setI((n) => n + 1);
    setPhase("answer");
    setAnswer("");
    setConfidence(0.6);
    setReveal(null);
    startRef.current = Date.now();
  }

  return (
    <section className="voice-section">
      <div className="voice-head">
        <h3 className="sub voice-title">Recall quiz</h3>
        {card && !finished && (
          <span className="recall-progress">
            {i + 1} / {queue!.length}
          </span>
        )}
      </div>

      {err && <div className="banner">{err}</div>}
      {queue === null && !err && <div className="muted">Loading recall…</div>}

      {(empty || finished) && (
        <div className="quiz-empty">
          <div className="quiz-empty-h">{answered > 0 ? "All done for today ✓" : "No recall questions yet"}</div>
          <p className="muted">
            {answered > 0
              ? `You answered ${answered} question${answered === 1 ? "" : "s"} today. Grades and your recall stats update after the next ingest.`
              : "Questions are generated from your notes by the morning ingest."}
          </p>
        </div>
      )}

      {card && !finished && (
        <div className="quiz-card">
          <div className="quiz-topic">{card.topic || "recall"}</div>
          <div className="quiz-stem">{card.stem}</div>

          {phase !== "revealed" ? (
            <>
              <textarea
                className="quiz-input"
                placeholder="Recall it, then reveal…  (⌘/Ctrl+Enter)"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
                }}
                autoFocus
                disabled={phase === "submitting"}
              />
              <div className="quiz-confidence">
                <label>How sure are you?</label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={confidence}
                  onChange={(e) => setConfidence(Number(e.target.value))}
                  disabled={phase === "submitting"}
                />
                <span className="conf-label">
                  {confidence < 0.34 ? "guessing" : confidence < 0.67 ? "fairly sure" : "certain"}
                </span>
              </div>
              <button className="btn btn-primary" onClick={submit} disabled={phase === "submitting"}>
                {phase === "submitting" ? "Saving…" : "Reveal answer"}
              </button>
            </>
          ) : (
            reveal && (
              <div className="quiz-reveal">
                <div className="reveal-ref">
                  <span className="reveal-label">Answer</span>
                  {reveal.referenceAnswer}
                </div>
                {reveal.requiredPoints.length > 0 && (
                  <ul className="reveal-points">
                    {reveal.requiredPoints.map((p, n) => (
                      <li key={n} className="pt">
                        {p}
                      </li>
                    ))}
                  </ul>
                )}
                {card.type === "conceptual" && (
                  <div className="reveal-why">Now say <b>why</b> — explain it in your own words.</div>
                )}
                <div className="reveal-foot">
                  <span className="reveal-src">{card.source_file.split("/").pop()}</span>
                  <button ref={continueRef} className="btn btn-primary" onClick={next}>
                    {i + 1 < queue!.length ? "Next →" : "Finish"}
                  </button>
                </div>
                <div className="reveal-note">Saved — graded automatically at the next ingest.</div>
              </div>
            )
          )}
        </div>
      )}
    </section>
  );
}
