// A day's note is ONE markdown file holding up to three visually-separate parts,
// kept apart by markers so they never merge in the editor:
//   1. the free-form WRITTEN notes (edited in BlockNote),
//   2. a VOICE NOTES section (STT transcripts), and
//   3. an SRS QUIZ section (the morning's recall questions) — managed by the
//      generator, preserved verbatim through written/voice edits.
// Pure + unit-tested.

export const VOICE_MARKER = "<!-- voice-notes -->";
export const QUIZ_MARKER = "<!-- srs:quiz -->";
const VOICE_HEADING = "## Voice notes";

export type DayParts = { written: string; voice: string[]; quiz: string };

/** Split a day's markdown into written notes, voice-note entries, and the raw
 *  quiz block (verbatim, incl. its marker). Order in the file: written, voice,
 *  quiz. No markers → everything is "written". */
export function splitDayNote(md: string): DayParts {
  const body = md ?? "";

  // Quiz block runs from QUIZ_MARKER to end and is preserved untouched.
  const qIdx = body.indexOf(QUIZ_MARKER);
  const quiz = qIdx === -1 ? "" : body.slice(qIdx).trimEnd();
  const preQuiz = qIdx === -1 ? body : body.slice(0, qIdx);

  const vIdx = preQuiz.indexOf(VOICE_MARKER);
  if (vIdx === -1) return { written: preQuiz.trim(), voice: [], quiz };

  const written = preQuiz.slice(0, vIdx).trimEnd();
  const after = preQuiz.slice(vIdx + VOICE_MARKER.length);
  const voice: string[] = [];
  for (const raw of after.split("\n")) {
    const line = raw.trim();
    if (!line || line === VOICE_HEADING) continue;
    const m = line.match(/^-\s+(.*)$/);
    if (m && m[1].trim()) voice.push(m[1].trim());
  }
  return { written, voice, quiz };
}

/** Recombine written + voice + (verbatim) quiz into one markdown body. Voice
 *  entries are one bullet each so they stay individually parseable. */
export function combineDayNote(written: string, voice: string[], quiz = ""): string {
  let out = (written ?? "").trimEnd();

  const entries = (voice ?? []).map((v) => v.replace(/\s+/g, " ").trim()).filter(Boolean);
  if (entries.length) {
    const bullets = entries.map((v) => `- ${v}`).join("\n");
    out = `${out}\n\n${VOICE_MARKER}\n${VOICE_HEADING}\n\n${bullets}`;
  }

  const q = (quiz ?? "").trim();
  if (q) out = out ? `${out}\n\n${q}` : q;

  return out ? out + "\n" : "";
}
