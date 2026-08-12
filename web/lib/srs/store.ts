// Git-backed persistence for the quiz. Cards live in one JSON map (a rebuildable
// projection); reviews are an append-only JSONL log (the source of truth — set
// `wiki/srs/reviews.jsonl merge=union` in .gitattributes so device appends never
// conflict). Reads/writes go through lib/storage (GitHub on Vercel, fs in dev).
import { readVaultFile, writeVaultFile } from "../storage";
import type { Card, CardBank, Review, Submission } from "./types";

const CARDS = "wiki/srs/cards.json";
const REVIEWS = "wiki/srs/reviews.jsonl";
const SUBMISSIONS = "wiki/srs/submissions.jsonl";

function parseJsonl<T>(content: string): T[] {
  const out: T[] = [];
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      out.push(JSON.parse(t) as T);
    } catch {
      /* skip a malformed line rather than lose the whole log */
    }
  }
  return out;
}

export async function readCards(): Promise<CardBank> {
  const f = await readVaultFile(CARDS);
  if (!f) return {};
  try {
    const o = JSON.parse(f.content);
    return o && typeof o === "object" && !Array.isArray(o) ? (o as CardBank) : {};
  } catch {
    return {};
  }
}

export async function writeCards(cards: CardBank, message: string): Promise<void> {
  await writeVaultFile(CARDS, JSON.stringify(cards, null, 2) + "\n", message);
}

export async function readReviews(): Promise<Review[]> {
  const f = await readVaultFile(REVIEWS);
  return f ? parseJsonl<Review>(f.content) : [];
}

// ---- submissions: the ungraded answer queue the ingest grades ----
export async function readSubmissions(): Promise<Submission[]> {
  const f = await readVaultFile(SUBMISSIONS);
  return f ? parseJsonl<Submission>(f.content) : [];
}

export async function appendSubmission(s: Submission, message: string): Promise<void> {
  const f = await readVaultFile(SUBMISSIONS);
  const prev = (f?.content ?? "").replace(/\s*$/, "");
  await writeVaultFile(SUBMISSIONS, (prev ? prev + "\n" : "") + JSON.stringify(s) + "\n", message);
}

/** Rewrite the queue (the ingest uses this to drop submissions it has graded). */
export async function writeSubmissions(list: Submission[], message: string): Promise<void> {
  const body = list.map((s) => JSON.stringify(s)).join("\n");
  await writeVaultFile(SUBMISSIONS, body ? body + "\n" : "", message);
}

/** Append one review line (read-modify-write; the file is small and union-merged). */
export async function appendReview(r: Review, message: string): Promise<void> {
  const f = await readVaultFile(REVIEWS);
  const prev = (f?.content ?? "").replace(/\s*$/, "");
  const next = (prev ? prev + "\n" : "") + JSON.stringify(r) + "\n";
  await writeVaultFile(REVIEWS, next, message);
}

export async function getCard(id: string): Promise<Card | null> {
  const cards = await readCards();
  return cards[id] ?? null;
}
