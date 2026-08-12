// Recall-quiz ingest engine. Run by the morning /ingest (which IS Claude, so no
// API key). Claude first writes its judgment to two handoff files:
//   wiki/srs/_grades.jsonl   — one {card_id, submission_ts?, verdict} per graded answer
//   wiki/srs/_newcards.jsonl — one candidate card (+ verification) per line
// Then it runs this script, which does the DETERMINISTIC bookkeeping only:
//   1. merge + FSRS-initialize new cards (gated + deduped)
//   2. apply grades: verdict → FSRS grade → advance schedule → append a review
//   3. rewrite the ungraded queue (drop processed) and the card projection
//   4. select today's set and write it into today's daily note
//   5. clear the handoff files
// Writes the LOCAL filesystem vault (commit via your normal git flow). Run:
//   cd web && npm run srs:ingest        (VAULT_PATH overrides the vault root)
import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import { applyReview } from "../lib/srs/schedule";
import { selectDaily } from "../lib/srs/select";
import { ratingFromVerdict } from "../lib/srs/grade";
import { buildCard, isDuplicate, passedGate, type Candidate, type Anno } from "../lib/srs/generate";
import { renderQuizSection } from "../lib/srs/daysection";
import { splitDayNote, combineDayNote } from "../lib/daynote";
import { todayStem, todayISO, prettyISO } from "../lib/day";
import type { CardBank, Review, Submission, Verdict } from "../lib/srs/types";

import { VAULT_ROOT as ROOT } from "../lib/vaultroot";

const DAILY_CAP = Number(process.env.QUIZ_DAILY_CAP || "20");
const abs = (rel: string) => path.join(ROOT, rel);

async function readText(rel: string): Promise<string | null> {
  try {
    return await fs.readFile(abs(rel), "utf8");
  } catch {
    return null;
  }
}
async function writeText(rel: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(abs(rel)), { recursive: true });
  await fs.writeFile(abs(rel), content, "utf8");
}
function parseJsonl<T>(text: string | null): T[] {
  if (!text) return [];
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .flatMap((l) => {
      try {
        return [JSON.parse(l) as T];
      } catch {
        return [];
      }
    });
}

type NewCardInput = Candidate & { source_file: string; topic: string; verification: Anno };
type GradeInput = { card_id: string; submission_ts?: string; verdict: Verdict };

async function main() {
  const nowISO = new Date().toISOString();
  const bankText = await readText("wiki/srs/cards.json");
  const bank: CardBank = bankText ? (JSON.parse(bankText) as CardBank) : {};
  const submissions = parseJsonl<Submission>(await readText("wiki/srs/submissions.jsonl"));
  const grades = parseJsonl<GradeInput>(await readText("wiki/srs/_grades.jsonl"));
  const newcards = parseJsonl<NewCardInput>(await readText("wiki/srs/_newcards.jsonl"));

  // 1. merge new cards (gated + deduped)
  const stems = Object.values(bank).map((c) => c.stem);
  let added = 0;
  for (const nc of newcards) {
    const cand: Candidate = {
      stem: nc.stem,
      reference_answer: nc.reference_answer,
      required_points: nc.required_points,
      source_span: nc.source_span,
      type: nc.type,
      bloom: nc.bloom,
      difficulty_target: nc.difficulty_target,
    };
    if (!passedGate(cand, nc.verification).passed || isDuplicate(cand.stem, stems)) continue;
    const card = buildCard(cand, { source_file: nc.source_file, topic: nc.topic }, nc.verification, nowISO);
    if (bank[card.id]) continue;
    bank[card.id] = card;
    stems.push(cand.stem);
    added++;
  }

  // 2. apply grades → FSRS advance + review log
  const processed = new Set<Submission>();
  const newReviews: Review[] = [];
  let graded = 0;
  for (const g of grades) {
    const card = bank[g.card_id];
    if (!card) continue;
    const matches = submissions
      .filter((s) => s.card_id === g.card_id && !processed.has(s) && (!g.submission_ts || s.ts === g.submission_ts))
      .sort((a, b) => a.ts.localeCompare(b.ts));
    const sub = matches[matches.length - 1]; // most recent matching answer
    if (!sub) continue;
    const rating = ratingFromVerdict(g.verdict);
    const next = applyReview(card.srs, rating, sub.ts); // grade AS OF when it was answered
    newReviews.push({
      card_id: g.card_id,
      ts: sub.ts,
      rating,
      verdict: g.verdict,
      confidence: sub.confidence,
      user_answer: sub.user_answer,
      auto: true,
      topic: card.topic,
      stability: next.stability,
      difficulty: next.difficulty,
      scheduled_days: next.scheduled_days,
      reps: next.reps,
      state: next.state,
      duration_ms: sub.duration_ms,
      grader_model: "claude-ingest",
    });
    card.srs = next;
    processed.add(sub);
    graded++;
  }

  // persist: reviews (append), submissions (drop processed), cards (projection)
  if (newReviews.length) {
    const prev = ((await readText("wiki/srs/reviews.jsonl")) ?? "").replace(/\s*$/, "");
    const body = [prev, ...newReviews.map((r) => JSON.stringify(r))].filter(Boolean).join("\n");
    await writeText("wiki/srs/reviews.jsonl", body + "\n");
  }
  const remaining = submissions.filter((s) => !processed.has(s));
  if (remaining.length !== submissions.length) {
    await writeText("wiki/srs/submissions.jsonl", remaining.map((s) => JSON.stringify(s)).join("\n") + (remaining.length ? "\n" : ""));
  }
  if (added || graded) await writeText("wiki/srs/cards.json", JSON.stringify(bank, null, 2) + "\n");

  // 3. select today's set → write into today's daily note
  const selected = selectDaily(Object.values(bank), { max: DAILY_CAP, now: nowISO });
  const stem = todayStem();
  const daily = await readText(`sources/daily/${stem}.md`);
  const fm =
    daily?.match(/^(---\n[\s\S]*?\n---\s*\n)/)?.[1] ?? `---\ntype: daily\nCreated: ${todayISO()}\n---\n`;
  const { written, voice } = splitDayNote(daily ? matter(daily).content.trim() : "");
  const quiz = selected.length ? renderQuizSection(selected, prettyISO(todayISO())) : "";
  await writeText(`sources/daily/${stem}.md`, fm + "\n" + combineDayNote(written, voice, quiz));

  // 4. clear the handoff files
  await writeText("wiki/srs/_grades.jsonl", "");
  await writeText("wiki/srs/_newcards.jsonl", "");

  console.log(
    `✓ srs ingest — +${added} new card(s), ${graded} graded, ${selected.length} selected for ${stem} (bank: ${Object.keys(bank).length})`,
  );
}

main().catch((e) => {
  console.error("srs ingest failed:", e);
  process.exit(1);
});
