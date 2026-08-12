// Card-assembly helpers. Generation (reading notes, writing questions) is done
// by Claude during the ingest — no API key, no SDK. Claude emits candidate cards
// with a self-verification annotation; the ingest script uses these PURE helpers
// to gate, dedup, id, and FSRS-initialize them. Unit-tested.
import type { Bloom, Card, QuestionType } from "./types";
import { newCardState } from "./schedule";

const GEN_MODEL = "claude-ingest";

export type Candidate = {
  stem: string;
  reference_answer: string;
  required_points: string[];
  source_span: string;
  type: QuestionType;
  bloom: Bloom;
  difficulty_target: number;
};

// Claude's honesty check on each candidate (mirrors the research's gate).
export type Anno = {
  answerable_from_span: boolean;
  reference_correct: boolean;
  answer_leak: boolean;
  ambiguous: boolean;
  trivial: boolean;
  answerable_without_source: boolean;
};

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function jaccard(a: string, b: string): number {
  const A = new Set(normalizeText(a).split(" ").filter(Boolean));
  const B = new Set(normalizeText(b).split(" ").filter(Boolean));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

/** The stem gives its own answer away (verbatim leak). */
export function stemLeaksAnswer(stem: string, answer: string): boolean {
  const a = normalizeText(answer);
  if (a.length < 3) return false;
  return normalizeText(stem).includes(a);
}

export function isDuplicate(stem: string, existing: string[], threshold = 0.8): boolean {
  const n = normalizeText(stem);
  return existing.some((e) => normalizeText(e) === n || jaccard(stem, e) >= threshold);
}

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export function cardId(stem: string, topic: string): string {
  return `${slug(topic || "card").slice(0, 20)}-${slug(stem).slice(0, 40)}-${hash(stem)}`
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Whether a verified candidate clears the gate (+ whether its stem leaks). */
export function passedGate(cand: Candidate, a: Anno): { passed: boolean; leak: boolean } {
  const leak = a.answer_leak || stemLeaksAnswer(cand.stem, cand.reference_answer);
  const passed =
    a.answerable_from_span &&
    a.reference_correct &&
    !leak &&
    !a.ambiguous &&
    !a.trivial &&
    !a.answerable_without_source;
  return { passed, leak };
}

export function buildCard(
  cand: Candidate,
  meta: { source_file: string; topic: string },
  a: Anno,
  nowISO: string,
): Card {
  const { leak } = passedGate(cand, a);
  const flags = [...(a.ambiguous ? ["ambiguous"] : []), ...(a.trivial ? ["trivial"] : [])];
  return {
    id: cardId(cand.stem, meta.topic),
    created: nowISO.slice(0, 10),
    source_file: meta.source_file,
    source_span: cand.source_span,
    topic: meta.topic,
    tags: [],
    gen_model: GEN_MODEL,
    type: cand.type,
    bloom: cand.bloom,
    difficulty_target: cand.difficulty_target,
    stem: cand.stem,
    reference_answer: cand.reference_answer,
    required_points: cand.required_points,
    verification: {
      answerable_from_span: a.answerable_from_span,
      answer_leak: leak,
      answerable_without_source: a.answerable_without_source,
      critic_flags: flags,
      passed: true,
    },
    srs: newCardState(nowISO),
  };
}
