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
import {
  buildCard,
  isDuplicate,
  passedGate,
  type Candidate,
  type Anno,
} from "../lib/srs/generate";
import { renderQuizSection, parseQuizIds } from "../lib/srs/daysection";
import { splitDayNote, combineDayNote } from "../lib/daynote";
import { todayStem, todayISO, prettyISO, dailyDate } from "../lib/day";
import type { CardBank, Review, Submission, Verdict } from "../lib/srs/types";
import { appendLocalRecords } from "../lib/changelog/local";
import { digest } from "../lib/changelog/records";
import { BASELINE, type Baseline } from "../lib/changelog/git";
import type { ChangeRecord, RecallRun } from "../lib/changelog/types";

const ROOT = process.env.VAULT_PATH || path.resolve(process.cwd(), "../examples/vault");
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
    .map((l, i) => {
      try {
        return JSON.parse(l) as T;
      } catch {
        throw new Error(`Malformed recall JSONL at nonempty line ${i + 1}; inputs were preserved`);
      }
    });
}

type NewCardInput = Candidate & {
  source_file: string;
  topic: string;
  verification: Anno;
};
type GradeInput = { card_id: string; submission_ts?: string; verdict: Verdict };

/** The card ids served on the most recent earlier day that had a quiz. */
async function previousQuizIds(todayStemStr: string): Promise<string[]> {
  try {
    const dir = path.join(ROOT, "sources", "daily");
    const stems = (await fs.readdir(dir))
      .filter((f) => f.toLowerCase().endsWith(".md"))
      .map((f) => f.replace(/\.md$/i, ""));
    const dated = stems
      .map((s) => ({ s, iso: dailyDate(s).iso }))
      .filter((x) => x.iso && x.iso < dailyDate(todayStemStr).iso)
      .sort((a, b) => b.iso.localeCompare(a.iso));
    for (const { s } of dated.slice(0, 3)) {
      const raw = await readText(`sources/daily/${s}.md`);
      if (!raw) continue;
      const ids = parseQuizIds(splitDayNote(matter(raw).content).quiz);
      if (ids.length) return ids;
    }
  } catch {
    /* no history is fine — nothing to avoid */
  }
  return [];
}

async function main() {
  const nowISO = new Date().toISOString();
  const bankText = await readText("wiki/srs/cards.json");
  const bank: CardBank = bankText ? (JSON.parse(bankText) as CardBank) : {};
  const submissions = parseJsonl<Submission>(
    await readText("wiki/srs/submissions.jsonl"),
  );
  const grades = parseJsonl<GradeInput>(
    await readText("wiki/srs/_grades.jsonl"),
  );
  const newcards = parseJsonl<NewCardInput>(
    await readText("wiki/srs/_newcards.jsonl"),
  );
  // Validate every verdict before any persistence; typos must not become lapses.
  for (const grade of grades) ratingFromVerdict(grade.verdict);
  const recall: RecallRun = {
    candidates: {
      received: newcards.length,
      rejected: 0,
      duplicates: 0,
      added: 0,
      addedIds: [],
      decisions: [],
    },
    grading: { received: grades.length, unmatched: 0, graded: 0, reviews: [] },
    selection: { date: todayISO(), total: 0, new: 0, due: 0, cardIds: [] },
    bankSize: 0,
    pendingAnswers: 0,
  };

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
    if (!passedGate(cand, nc.verification).passed) {
      recall.candidates.rejected++;
      recall.candidates.decisions.push({
        stem: cand.stem,
        outcome: "rejected",
        reason: "verification gate",
      });
      continue;
    }
    if (isDuplicate(cand.stem, stems)) {
      recall.candidates.duplicates++;
      recall.candidates.decisions.push({
        stem: cand.stem,
        outcome: "duplicate",
        reason: "matching stem",
      });
      continue;
    }
    const card = buildCard(
      cand,
      { source_file: nc.source_file, topic: nc.topic },
      nc.verification,
      nowISO,
    );
    if (bank[card.id]) {
      recall.candidates.duplicates++;
      recall.candidates.decisions.push({
        stem: cand.stem,
        outcome: "duplicate",
        reason: "existing card id",
        cardId: card.id,
      });
      continue;
    }
    bank[card.id] = card;
    stems.push(cand.stem);
    added++;
    recall.candidates.addedIds.push(card.id);
    recall.candidates.decisions.push({
      stem: cand.stem,
      outcome: "added",
      cardId: card.id,
    });
  }

  // 2. apply grades → FSRS advance + review log
  const processed = new Set<Submission>();
  const newReviews: Review[] = [];
  let graded = 0;
  for (const g of [...grades].sort((a, b) => (a.submission_ts ?? "").localeCompare(b.submission_ts ?? ""))) {
    const card = bank[g.card_id];
    if (!card) {
      recall.grading.unmatched++;
      continue;
    }
    const matches = submissions
      .filter(
        (s) =>
          s.card_id === g.card_id &&
          !processed.has(s) &&
          (!g.submission_ts || s.ts === g.submission_ts),
      )
      .sort((a, b) => a.ts.localeCompare(b.ts));
    const sub = matches[matches.length - 1]; // most recent matching answer
    if (!sub) {
      recall.grading.unmatched++;
      continue;
    }
    const rating = ratingFromVerdict(g.verdict);
    const next = applyReview(card.srs, rating, sub.ts); // grade AS OF when it was answered
    recall.grading.reviews.push({
      cardId: card.id,
      answeredAt: sub.ts,
      verdict: g.verdict,
      rating,
      dueBefore: card.srs.due,
      dueAfter: next.due,
      stateBefore: card.srs.state,
      stateAfter: next.state,
    });
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
      grader_model: "cortex-ingest",
    });
    card.srs = next;
    processed.add(sub);
    graded++;
  }

  // persist: reviews (append), submissions (drop processed), cards (projection)
  if (newReviews.length) {
    const prev = ((await readText("wiki/srs/reviews.jsonl")) ?? "").replace(
      /\s*$/,
      "",
    );
    const body = [prev, ...newReviews.map((r) => JSON.stringify(r))]
      .filter(Boolean)
      .join("\n");
    await writeText("wiki/srs/reviews.jsonl", body + "\n");
  }
  const remaining = submissions.filter((s) => !processed.has(s));
  if (remaining.length !== submissions.length) {
    await writeText(
      "wiki/srs/submissions.jsonl",
      remaining.map((s) => JSON.stringify(s)).join("\n") +
        (remaining.length ? "\n" : ""),
    );
  }
  if (added || graded)
    await writeText(
      "wiki/srs/cards.json",
      JSON.stringify(bank, null, 2) + "\n",
    );

  // 3. select today's set → write into today's daily note.
  // Pass yesterday's ids so today can't hand back the same questions: a New card
  // only advances once an answer is graded, so while grading lags the pool is
  // static and an unrotated pick repeats verbatim.
  const stem = todayStem();
  const prevIds = await previousQuizIds(stem);
  let selected = selectDaily(Object.values(bank), {
    max: DAILY_CAP,
    now: nowISO,
    exclude: prevIds,
  });
  const daily = await readText(`sources/daily/${stem}.md`);
  // A second ingest must not replace questions the user has already started.
  const existingQuiz = daily ? splitDayNote(matter(daily).content).quiz : "";
  const existingIds = parseQuizIds(existingQuiz);
  if (existingIds.length) selected = existingIds.map(id => bank[id]).filter(card => card && !card.suspended);
  const fm =
    daily?.match(/^(---\n[\s\S]*?\n---\s*\n)/)?.[1] ??
    `---\ntype: daily\nCreated: ${todayISO()}\n---\n`;
  const { written, voice } = splitDayNote(
    daily ? matter(daily).content.trim() : "",
  );
  const quiz = selected.length
    ? renderQuizSection(selected, prettyISO(todayISO()))
    : "";
  await writeText(
    `sources/daily/${stem}.md`,
    fm.trimEnd() + "\n\n" + combineDayNote(written, voice, quiz),
  );

  // Emit the numbers computed by this run, never inferred from a later diff.
  recall.candidates.added = added;
  recall.grading.graded = graded;
  recall.bankSize = Object.keys(bank).length;
  recall.pendingAnswers = remaining.length;
  recall.selection = {
    date: todayISO(),
    total: selected.length,
    new: selected.filter((card) => card.srs.state === 0).length,
    due: selected.filter((card) => card.srs.state !== 0).length,
    cardIds: selected.map((card) => card.id),
  };
  const baselineRaw = await readText(BASELINE);
  const runId = baselineRaw
    ? (JSON.parse(baselineRaw) as Baseline).runId
    : `srs-${todayISO()}-${digest(JSON.stringify(recall))}`;
  const record: ChangeRecord = {
    id: digest(`${runId}:recall:${JSON.stringify(recall)}`),
    timestamp: nowISO,
    source: "srs",
    runId,
    surface: "recall",
    action: "run",
    path: "wiki/srs/",
    title: "Recall run",
    recall,
  };
  await appendLocalRecords(ROOT, [record]);

  // 4. clear the handoff files
  await writeText("wiki/srs/_grades.jsonl", "");
  await writeText("wiki/srs/_newcards.jsonl", "");

  console.log(
    `✓ srs ingest — +${added} new card(s), ${graded} graded, ${selected.length} selected for ${stem} (bank: ${Object.keys(bank).length})`,
  );

  // Make a stalled deck loud instead of silent. Cards only leave the New state
  // when an answer is graded, so a bank that is overwhelmingly New means the
  // answer→grade loop is not closing and the schedule is not advancing.
  const all = Object.values(bank);
  const newCount = all.filter((c) => c.srs.state === 0).length;
  if (all.length >= 20 && newCount / all.length > 0.8) {
    console.warn(
      `⚠ ${newCount}/${all.length} cards are still New. Answers are captured in ` +
        `wiki/srs/submissions.jsonl and only advance once the ingest GRADES them ` +
        `(step 10a → _grades.jsonl). Until then the schedule cannot progress.`,
    );
  }
  const repeat = prevIds.length
    ? selected.filter((c) => prevIds.includes(c.id)).length
    : 0;
  if (repeat && repeat === selected.length) {
    console.warn(
      `⚠ today's ${repeat} question(s) all repeat the previous day's set.`,
    );
  }
}

main().catch((e) => {
  console.error("srs ingest failed:", e);
  process.exit(1);
});
