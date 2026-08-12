// Generates the DEMO spaced-repetition data for the example vault:
//   examples/vault/wiki/srs/cards.json   (the card bank)
//   examples/vault/wiki/srs/reviews.jsonl (14-day review history)
// so the web app's Recall dashboard renders with real-looking numbers out of the
// box. It's deliberately time-anchored at BASE below — re-run it (optionally edit
// BASE to today) to refresh the demo. Deterministic: no Math.random, no clock.
//
//   node examples/seed-demo-srs.mjs
//
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const BASE = "2026-08-11"; // the demo's "today"
const here = path.dirname(fileURLToPath(import.meta.url));
const SRS = path.join(here, "vault", "wiki", "srs");

const day = (offset) => {
  const [y, m, d] = BASE.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
};
const dt = (offset, hour = 9) => `${day(offset)}T${String(hour).padStart(2, "0")}:15:00.000Z`;

// id, topic, stem, reference, points, source, state(2=Review 0=New), stability, difficulty, dueOffset, reps, lapses
const CARDS = [
  ["c-sr-01", "spaced repetition", "Why does retrieval practice beat re-reading for retention?", "Recalling a fact strengthens the memory more than re-reading it (effortful retrieval).", ["retrieval strengthens memory", "more than re-reading"], "wiki/pages/spaced-repetition.md", 2, 12, 5.1, 1, 4, 0],
  ["c-sr-02", "spaced repetition", "What two per-card quantities does FSRS model to choose the next interval?", "Stability (how long the memory lasts) and difficulty.", ["stability", "difficulty"], "wiki/pages/spaced-repetition.md", 2, 25, 4.4, 9, 6, 0],
  ["c-sr-03", "spaced repetition", "Which metric best measures whether a spaced-repetition schedule is working?", "True retention on graduated cards (pass rate on cards seen more than once).", ["true retention", "graduated cards"], "wiki/pages/spaced-repetition.md", 2, 8, 5.6, 0, 3, 0],
  ["c-sr-04", "spaced repetition", "What makes a review a 'graduated' recall rather than initial learning?", "The card has been seen more than once (reps >= 2), so it's a genuine recall attempt.", ["seen more than once", "reps >= 2"], "wiki/pages/spaced-repetition.md", 0, 0, 5.0, 0, 0, 0],
  ["c-attn-01", "transformer attention", "In attention, what do the Query, Key, and Value vectors represent?", "Query = what a token looks for; Key = what each token offers; Value = the content mixed in.", ["query looks for", "key offers", "value is content"], "wiki/pages/transformer-attention.md", 2, 5, 6.0, 0, 2, 1],
  ["c-attn-02", "transformer attention", "Why are dot products divided by the square root of d_k in scaled dot-product attention?", "To stop dot products growing with dimension and saturating the softmax (vanishing gradients).", ["dot products grow with dimension", "keeps softmax/gradients stable"], "wiki/pages/transformer-attention.md", 2, 30, 4.0, 14, 7, 0],
  ["c-attn-03", "transformer attention", "What does multi-head attention add over a single attention function?", "Several heads attend to different relationships in parallel, then concatenate.", ["multiple heads in parallel", "different relationships"], "wiki/pages/transformer-attention.md", 2, 3, 6.3, 0, 2, 1],
  ["c-attn-04", "transformer attention", "In self-attention, each token attends to what?", "Every other token in the sequence (including itself).", ["every other token"], "wiki/pages/transformer-attention.md", 2, 40, 3.6, 21, 8, 0],
  ["c-tf-01", "transformers", "Why does the Transformer drop recurrence entirely?", "So sequence positions are processed in parallel, making training much faster.", ["parallel processing", "faster training"], "wiki/pages/attention-is-all-you-need.md", 2, 15, 4.8, 7, 5, 0],
  ["c-tf-02", "transformers", "Without recurrence, how does a Transformer represent token position?", "With explicit positional encodings (e.g. sinusoidal) added to the embeddings.", ["positional encoding", "added explicitly"], "wiki/pages/attention-is-all-you-need.md", 0, 0, 5.0, 0, 0, 0],
];

const bank = {};
for (const [id, topic, stem, ref, points, src, state, stability, difficulty, dueOff, reps, lapses] of CARDS) {
  bank[id] = {
    id,
    created: `${day(-16)}T09:00:00.000Z`,
    source_file: src,
    source_span: ref,
    topic,
    tags: [topic.split(" ")[0]],
    gen_model: "demo-seed",
    type: "short_answer",
    bloom: "understand",
    difficulty_target: 3,
    stem,
    reference_answer: ref,
    required_points: points,
    verification: {
      answerable_from_span: true,
      answer_leak: false,
      answerable_without_source: false,
      critic_flags: [],
      passed: true,
    },
    srs: {
      due: `${day(dueOff)}T09:00:00.000Z`,
      stability,
      difficulty,
      elapsed_days: state === 0 ? 0 : Math.max(1, Math.round(stability / 2)),
      scheduled_days: state === 0 ? 0 : Math.round(stability),
      learning_steps: 0,
      reps,
      lapses,
      state,
      ...(state === 0 ? {} : { last_review: `${day(-1)}T09:15:00.000Z` }),
    },
  };
}

// ---- review history: one graduated pass over the last 14 days -----------------
// Round-robin over the "seen" (non-New) cards, ~85% correct, confidence tracking
// correctness so the calibration chart looks sensible.
const seen = CARDS.filter((c) => c[6] !== 0).map((c) => c[0]);
const reviews = [];
const repCount = {};
seen.forEach((id) => (repCount[id] = 1)); // first exposure already happened pre-window
let k = 0;
for (let offset = -13; offset <= 0; offset++) {
  const perDay = 2 + (offset % 2 === 0 ? 1 : 0); // 2–3 reviews/day
  for (let j = 0; j < perDay; j++) {
    const id = seen[k % seen.length];
    k++;
    const c = bank[id];
    repCount[id] += 1;
    // deterministic ~85% pass pattern (fail every 7th)
    const fail = k % 7 === 0;
    const verdict = fail ? "incorrect" : k % 5 === 0 ? "partial" : "correct";
    const rating = verdict === "correct" ? 3 : verdict === "partial" ? 2 : 1;
    const confidence = verdict === "correct" ? 0.85 : verdict === "partial" ? 0.6 : 0.45;
    reviews.push({
      card_id: id,
      ts: dt(offset, 9 + j),
      rating,
      verdict,
      confidence,
      user_answer: verdict === "correct" ? c.reference_answer : "(demo answer)",
      auto: true,
      topic: c.topic,
      stability: c.srs.stability,
      difficulty: c.srs.difficulty,
      scheduled_days: c.srs.scheduled_days,
      reps: repCount[id],
      state: 2,
      duration_ms: 9000 + ((k * 137) % 6000),
      grader_model: "demo-seed",
    });
  }
}

fs.mkdirSync(SRS, { recursive: true });
fs.writeFileSync(path.join(SRS, "cards.json"), JSON.stringify(bank, null, 2) + "\n");
fs.writeFileSync(path.join(SRS, "reviews.jsonl"), reviews.map((r) => JSON.stringify(r)).join("\n") + "\n");
fs.writeFileSync(path.join(SRS, "submissions.jsonl"), "");
console.log(`wrote ${Object.keys(bank).length} cards, ${reviews.length} reviews → ${SRS}`);
