"use client";

import { useEffect, useState } from "react";
import { todayStem } from "@/lib/day";
import { DayEditor } from "./DayEditor";
import { QuizSection } from "./QuizSection";

// Today's note. The current day is computed on the client (in New York time) and
// re-checked whenever the app regains focus/visibility and on a periodic tick —
// because iOS suspends a home-screen web app and later *resumes* it (without
// remounting), which previously left "today" frozen at whatever day the app was
// opened. A frozen day meant "Save to wiki" could overwrite an older day's note.
// Keeping the day live means a save always lands on the real current date.
export function TodayTab() {
  const [stem, setStem] = useState<string>(() => todayStem());

  useEffect(() => {
    const sync = () => {
      const now = todayStem();
      setStem((cur) => (now !== cur ? now : cur));
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    const id = setInterval(sync, 30_000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", sync);
    window.addEventListener("pageshow", sync); // bfcache restore (iOS)
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", sync);
      window.removeEventListener("pageshow", sync);
    };
  }, []);

  // Keyed by the day so a date rollover fully resets the editor + quiz onto the
  // new note (written notes, voice notes, then the recall quiz — all one day).
  return (
    <>
      <DayEditor key={stem} stem={stem} />
      <QuizSection key={`quiz-${stem}`} />
    </>
  );
}
