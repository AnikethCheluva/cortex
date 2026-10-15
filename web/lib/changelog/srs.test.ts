import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { afterEach, expect, it } from "vitest";
import { buildCard, type Anno, type Candidate } from "../srs/generate";
import { changeDate } from "./records";
const execute = promisify(execFile);
let root: string;
afterEach(async () => {
  if (root) await fs.rm(root, { recursive: true, force: true });
});
it("emits actual SRS gates, duplicates, grades, schedule changes and selection counts", async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "cortex-recall-test-"));
  const write = async (file: string, text: string) => {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), text);
  };
  const verification: Anno = {
    answerable_from_span: true,
    reference_correct: true,
    answer_leak: false,
    ambiguous: false,
    trivial: false,
    answerable_without_source: false,
  };
  const candidate: Candidate = {
    stem: "What does the policy predict?",
    reference_answer: "actions",
    required_points: ["actions"],
    source_span: "The policy predicts actions.",
    type: "short_answer",
    bloom: "understand",
    difficulty_target: 2,
  };
  const card = buildCard(
    candidate,
    { source_file: "wiki/pages/policy.md", topic: "policy" },
    verification,
    new Date(Date.now() - 86400000).toISOString(),
  );
  await write("wiki/srs/cards.json", JSON.stringify({ [card.id]: card }));
  const sub = {
    card_id: card.id,
    ts: new Date(Date.now() - 3600000).toISOString(),
    user_answer: "actions",
    confidence: 0.8,
  };
  await write("wiki/srs/submissions.jsonl", JSON.stringify(sub) + "\n");
  await write(
    "wiki/srs/_grades.jsonl",
    [
      JSON.stringify({
        card_id: card.id,
        submission_ts: sub.ts,
        verdict: "correct",
      }),
      JSON.stringify({ card_id: "missing", verdict: "partial" }),
    ].join("\n"),
  );
  const next = {
    ...candidate,
    stem: "Which data split checks generalization?",
    reference_answer: "validation",
    source_span: "Validation checks generalization.",
    required_points: ["validation"],
    source_file: "wiki/pages/policy.md",
    topic: "policy",
    verification,
  };
  await write(
    "wiki/srs/_newcards.jsonl",
    [
      next,
      next,
      {
        ...next,
        stem: "A rejected question?",
        verification: { ...verification, trivial: true },
      },
    ]
      .map((row) => JSON.stringify(row))
      .join("\n"),
  );
  await execute(process.execPath, ["--import", "tsx", "scripts/srs.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, VAULT_PATH: root },
    maxBuffer: 4 * 1024 * 1024,
  });
  const date = changeDate(new Date().toISOString());
  const journal = JSON.parse(
    await fs.readFile(path.join(root, `wiki/changelog/${date}.json`), "utf8"),
  );
  const run = journal.records[0].recall;
  expect(run.candidates).toMatchObject({
    received: 3,
    added: 1,
    duplicates: 1,
    rejected: 1,
  });
  expect(run.grading).toMatchObject({ received: 2, graded: 1, unmatched: 1 });
  expect(run.grading.reviews[0]).toMatchObject({
    cardId: card.id,
    verdict: "correct",
    rating: 3,
    stateBefore: 0,
  });
  expect(run.grading.reviews[0].dueAfter).not.toBe(
    run.grading.reviews[0].dueBefore,
  );
  expect(run.bankSize).toBe(2);
  expect(run.pendingAnswers).toBe(0);
  expect(run.selection.total).toBe(run.selection.new + run.selection.due);
  expect(run.selection.cardIds).toHaveLength(run.selection.total);
  expect(
    await fs.readFile(path.join(root, "wiki/srs/_grades.jsonl"), "utf8"),
  ).toBe("");
  // A later ingest may add material, but must preserve the quiz already served.
  const dailyPath = path.join(root, "sources/daily", (await fs.readdir(path.join(root, "sources/daily")))[0]);
  const published = await fs.readFile(dailyPath, "utf8");
  await write("wiki/srs/_newcards.jsonl", JSON.stringify({...next, stem:"Why keep a held-out evaluation set?"}) + "\n");
  const invoke = () => execute(process.execPath, ["--import", "tsx", "scripts/srs.ts"], {
    cwd: process.cwd(), env: {...process.env, VAULT_PATH:root}, maxBuffer:4*1024*1024,
  });
  await invoke();
  expect(await fs.readFile(dailyPath, "utf8")).toBe(published);
  // Corrupt handoffs fail before writing anything; never silently lose a row.
  const before = await fs.readFile(path.join(root,"wiki/srs/cards.json"),"utf8");
  await write("wiki/srs/_grades.jsonl", "{broken json\n");
  await expect(invoke()).rejects.toThrow();
  expect(await fs.readFile(path.join(root,"wiki/srs/cards.json"),"utf8")).toBe(before);
  expect(await fs.readFile(path.join(root,"wiki/srs/_grades.jsonl"),"utf8")).toBe("{broken json\n");
  await write("wiki/srs/_grades.jsonl", JSON.stringify({card_id:card.id,verdict:"typo"})+"\n");
  await expect(invoke()).rejects.toThrow();
  expect(await fs.readFile(path.join(root,"wiki/srs/cards.json"),"utf8")).toBe(before);
});
