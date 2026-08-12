"use client";

// Client → server write endpoints. These run against the dynamic route
// handlers, which commit to GitHub on Vercel (or the local fs in dev).
import type { Task, NoteDocMeta, NoteDoc } from "./types";
import type { PublicCard } from "./srs/types";
import type { QuizStats } from "./srs/stats";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const e = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(e.error || `request failed (${res.status})`);
  }
  return res.json();
}

export type DayNote = {
  stem: string;
  iso: string;
  label: string;
  body: string;
  exists: boolean;
  isToday?: boolean;
};
export type TodayNote = DayNote;

// `?t=` cache-buster: iOS standalone (home-screen) web apps cache GETs even with
// cache:"no-store", so a unique URL is the only reliable way to force a fresh read.
export const getToday = () =>
  fetch(`/api/daily/today?t=${Date.now()}`, { cache: "no-store" }).then(json<TodayNote>);

// Load / save any day by its filename stem (M-D-YY or ISO). Used by the unified
// Daily page so today and the archive are edited through one code path.
export const getDay = (stem: string) =>
  fetch(`/api/daily/${encodeURIComponent(stem)}?t=${Date.now()}`, {
    cache: "no-store",
  }).then(json<DayNote>);
export const saveDay = (stem: string, body: string) =>
  fetch(`/api/daily/${encodeURIComponent(stem)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ body }),
  }).then(json<{ ok: boolean; stem: string }>);

// ---- persistent documents (Google-Docs-style; stored as wiki sources) ----
export const listNotes = () =>
  fetch(`/api/notes?t=${Date.now()}`, { cache: "no-store" }).then(json<{ notes: NoteDocMeta[] }>);

export const getNote = (slug: string) =>
  fetch(`/api/notes/${encodeURIComponent(slug)}?t=${Date.now()}`, { cache: "no-store" }).then(
    json<NoteDoc>,
  );

export const createNote = (title?: string) =>
  fetch("/api/notes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title }),
  }).then(json<NoteDocMeta>);

export const saveNote = (slug: string, input: { title: string; body: string }) =>
  fetch(`/api/notes/${encodeURIComponent(slug)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  }).then(json<{ ok: boolean; slug: string }>);

export const deleteNote = (slug: string) =>
  fetch(`/api/notes/${encodeURIComponent(slug)}`, { method: "DELETE" }).then(
    json<{ ok: boolean }>,
  );

export const createTask = (input: {
  title: string;
  project?: string;
  priority?: string;
  due_date?: string;
  page_slug?: string;
}) =>
  fetch("/api/tasks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  }).then(json<Task>);

export const updateTask = (
  id: string,
  patch: Partial<Pick<Task, "status" | "priority" | "body">>,
) =>
  fetch(`/api/tasks/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  }).then(json<Task>);

// ---- recall quiz (keyless: submit reveals the answer; the ingest grades) ----
export type QuizReveal = { referenceAnswer: string; requiredPoints: string[]; sourceFile: string };

export const getQuizToday = () =>
  fetch(`/api/quiz/today?t=${Date.now()}`, { cache: "no-store" }).then(
    json<{ stem: string; cards: PublicCard[]; submittedIds: string[] }>,
  );

// Queue an answer (ungraded) and get back the reference answer to reveal.
export const submitAnswer = (input: {
  cardId: string;
  answer: string;
  confidence: number;
  durationMs?: number;
}) =>
  fetch("/api/quiz/submit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  }).then(json<QuizReveal>);

export const getQuizStats = () =>
  fetch(`/api/quiz/stats?t=${Date.now()}`, { cache: "no-store" }).then(json<QuizStats>);

// A past day's quiz for read-only review in the Daily tab (answers included).
export type DayQuizCard = {
  id: string;
  stem: string;
  topic: string;
  type: string;
  source_file: string;
  referenceAnswer: string;
  requiredPoints: string[];
};
export const getQuizDay = (stem: string) =>
  fetch(`/api/quiz/day/${encodeURIComponent(stem)}?t=${Date.now()}`, { cache: "no-store" }).then(
    json<{ stem: string; cards: DayQuizCard[] }>,
  );

// ---- voice notes: upload recorded audio, get back the transcript ----
export async function transcribeAudio(blob: Blob): Promise<string> {
  const form = new FormData();
  const ext = (blob.type.split("/")[1] || "webm").split(";")[0];
  form.append("audio", blob, `note.${ext}`);
  const res = await fetch("/api/transcribe", { method: "POST", body: form });
  const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
  if (!res.ok) throw new Error(data.error || `transcription failed (${res.status})`);
  return (data.text ?? "").trim();
}
