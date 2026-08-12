"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { getDay, saveDay, type DayNote } from "@/lib/clientapi";
import { splitDayNote, combineDayNote } from "@/lib/daynote";
import { useVoiceRecorder } from "@/lib/useVoiceRecorder";

// BlockNote is client-only (DOM-dependent) — load it lazily, never on the server.
const NoteEditor = dynamic(() => import("./NoteEditor"), {
  ssr: false,
  loading: () => <div className="note-surface" />,
});

function sameArr(a: string[], b: string[]) {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

function fmtTime(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Editor for a single day's note, identified by its filename stem (M-D-YY / ISO).
// One markdown file holds two visually-separate parts: the WRITTEN notes (in the
// BlockNote editor) and a VOICE NOTES section below it (STT transcripts). They're
// split on load and recombined on save so they never merge in the editor.
export function DayEditor({ stem }: { stem: string }) {
  const [day, setDay] = useState<DayNote | null>(null);
  const [initialWritten, setInitialWritten] = useState<string | null>(null);
  const [written, setWritten] = useState("");
  const [voice, setVoice] = useState<string[]>([]);
  const [savedWritten, setSavedWritten] = useState("");
  const [savedVoice, setSavedVoice] = useState<string[]>([]);
  const [state, setState] = useState("");
  const [error, setError] = useState("");
  const autosave = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false); // guards against overlapping saves
  const tickRef = useRef<() => void>(() => {}); // latest autosave check for the interval
  const quizRef = useRef(""); // server-managed <!-- srs:quiz --> block, preserved verbatim

  const lsKey = `daily-draft:${stem}`;
  const dirty = written !== savedWritten || !sameArr(voice, savedVoice);

  // Load the note live from the vault, splitting it into written + voice parts.
  useEffect(() => {
    let cancelled = false;
    setDay(null);
    setInitialWritten(null);
    setState("");
    setError("");
    getDay(stem)
      .then((d) => {
        if (cancelled) return;
        // A draft (combined markdown) exists only for unsaved edits; otherwise
        // load the committed note.
        const draft = localStorage.getItem(`daily-draft:${stem}`);
        const src = draft != null && draft !== d.body ? draft : d.body;
        if (draft != null && draft === d.body) {
          localStorage.removeItem(`daily-draft:${stem}`);
        }
        const cur = splitDayNote(src);
        const base = splitDayNote(d.body);
        quizRef.current = base.quiz; // preserve the morning quiz across edits
        setDay(d);
        setWritten(cur.written);
        setVoice(cur.voice);
        setInitialWritten(cur.written);
        setSavedWritten(base.written);
        setSavedVoice(base.voice);
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [stem]);

  // Autosave the combined draft to localStorage while dirty (crash-safe), and
  // clear it when clean so a stale draft never shadows the committed note.
  useEffect(() => {
    if (autosave.current) clearTimeout(autosave.current);
    autosave.current = setTimeout(() => {
      if (dirty) localStorage.setItem(lsKey, combineDayNote(written, voice, quizRef.current));
      else localStorage.removeItem(lsKey);
    }, 400);
  }, [written, voice, dirty, lsKey]);

  // Flush immediately if the tab is hidden/closed mid-debounce.
  useEffect(() => {
    const flush = () => {
      if (dirty) localStorage.setItem(lsKey, combineDayNote(written, voice, quizRef.current));
      else localStorage.removeItem(lsKey);
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [written, voice, dirty, lsKey]);

  const save = useCallback(
    async (auto = false) => {
      if (savingRef.current) return; // don't overlap saves (manual + autosave)
      savingRef.current = true;
      setState(auto ? "autosaving…" : "saving…");
      setError("");
      try {
        await saveDay(stem, combineDayNote(written, voice, quizRef.current));
        setSavedWritten(written);
        setSavedVoice([...voice]);
        localStorage.removeItem(lsKey);
        setState(auto ? "autosaved" : "saved to wiki");
        setTimeout(() => setState(""), 2000);
      } catch (e) {
        setError((e as Error).message);
        setState("");
      } finally {
        savingRef.current = false;
      }
    },
    [stem, written, voice, lsKey],
  );

  // Autosave: every 5 minutes, if today's note has unsaved changes, commit them.
  // (Local drafts already persist per-device; this pushes to the repo so today's
  // note is durable + synced across devices without waiting for a manual save.)
  useEffect(() => {
    tickRef.current = () => {
      if (day?.isToday && dirty && !savingRef.current) void save(true);
    };
  });
  useEffect(() => {
    const id = setInterval(() => tickRef.current(), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const addVoice = useCallback((text: string) => {
    setVoice((v) => [...v, text.trim()]);
  }, []);
  const removeVoice = useCallback((i: number) => {
    setVoice((v) => v.filter((_, j) => j !== i));
  }, []);

  const rec = useVoiceRecorder(addVoice);

  if (error && !day) return <div className="banner">Couldn’t load note: {error}</div>;

  return (
    <div>
      <div className="datenav">
        <span className="day">{day?.label ?? stem}</span>
        {day?.isToday && <span className="today-dot">today</span>}
      </div>

      <div className="editor-bar">
        <button className="btn btn-primary small" onClick={() => save()} disabled={!dirty}>
          Save to wiki
        </button>
        <span className="save-state">
          {state || (dirty ? "unsaved changes" : day?.exists ? "saved" : "")}
        </span>
      </div>
      {error && <div className="banner">{error}</div>}

      {initialWritten === null ? (
        <div className="note-surface" />
      ) : (
        <NoteEditor key={stem} initialMarkdown={initialWritten} onChange={setWritten} />
      )}

      {/* Voice notes: a separate section below the written notes, same .md file. */}
      <section className="voice-section">
        <div className="voice-head">
          <h3 className="sub voice-title">Voice notes</h3>
          {rec.state === "recording" ? (
            <button className="mic-btn recording" onClick={rec.stop}>
              <span className="mic-dot" />
              Stop · {fmtTime(rec.seconds)}
            </button>
          ) : rec.state === "transcribing" ? (
            <button className="mic-btn" disabled>
              <span className="mic-spin" />
              Transcribing…
            </button>
          ) : (
            <button
              className="mic-btn"
              onClick={rec.start}
              disabled={!rec.supported}
              title={rec.supported ? "Record a voice note" : "Voice recording isn’t supported here"}
            >
              <MicIcon />
              Record
            </button>
          )}
        </div>

        {rec.state === "error" && <div className="mic-err">{rec.error}</div>}

        {voice.length === 0 ? (
          <div className="voice-empty">
            No voice notes yet — tap <b>Record</b>, speak, and the transcript lands here.
          </div>
        ) : (
          <ul className="voice-list">
            {voice.map((v, i) => (
              <li key={i} className="voice-item">
                <span className="voice-text">{v}</span>
                <button
                  className="voice-del"
                  title="Delete this voice note"
                  onClick={() => removeVoice(i)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function MicIcon() {
  return (
    <svg
      className="mic-icon"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}
