// Spaced-repetition quiz — shared shapes. Pure types only (no fs/SDK), so both
// client components and server routes can import them.

export type QuestionType = "short_answer" | "cloze" | "mcq" | "conceptual";
export type Bloom = "remember" | "understand" | "apply" | "analyze" | "evaluate";
export type Verdict = "correct" | "partial" | "incorrect";
// FSRS grade: 1 Again · 2 Hard · 3 Good · 4 Easy.
export type Rating = 1 | 2 | 3 | 4;

export type MCQChoice = { text: string; correct: boolean };

// Serialized FSRS state (mirrors ts-fsrs Card, dates as ISO strings so it's
// JSON/git-friendly). `state`: 0 New · 1 Learning · 2 Review · 3 Relearning.
export type CardState = {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review?: string;
};

export type Card = {
  // identity / provenance
  id: string;
  created: string; // ISO date
  source_file: string; // "wiki/pages/foo.md" | "sources/daily/7-27-26.md"
  source_span: string; // verbatim quote the question is grounded in
  topic: string;
  tags: string[];
  gen_model: string;

  // content
  type: QuestionType;
  bloom: Bloom;
  difficulty_target: number; // 1..5
  stem: string;
  cloze_text?: string;
  choices?: MCQChoice[];

  // grading key (stored at generation → reference-based grading)
  reference_answer: string;
  required_points: string[];
  acceptable_variants?: string[];

  // generation gate result
  verification?: {
    answerable_from_span: boolean;
    answer_leak: boolean;
    answerable_without_source: boolean;
    critic_flags: string[];
    passed: boolean;
  };

  // spaced-repetition state
  srs: CardState;
  suspended?: boolean; // leech / retired
};

export type CardBank = Record<string, Card>;

// One answered review — appended to reviews.jsonl (append-only source of truth).
// Carries a post-review FSRS snapshot so charts need no recomputation.
export type Review = {
  card_id: string;
  ts: string; // ISO datetime
  rating: Rating;
  verdict: Verdict;
  confidence: number; // 0..1 self-reported (pre-answer)
  user_answer: string;
  auto: boolean; // graded by the model (false = user override)
  topic: string;
  stability: number;
  difficulty: number;
  scheduled_days: number;
  reps: number;
  state: number;
  duration_ms?: number;
  grader_model?: string;
};

// A raw, UNGRADED answer captured by the web app. Appended to submissions.jsonl
// and graded later by the ingest (which is Claude — no API key in the web app).
export type Submission = {
  card_id: string;
  ts: string; // ISO datetime the answer was submitted
  user_answer: string;
  confidence: number; // 0..1 self-reported
  duration_ms?: number;
};

// What the client sees for an unanswered question — deliberately WITHOUT the
// reference answer or rubric (grading is server-side, so the answer can't be
// peeked from the network payload).
export type PublicCard = {
  id: string;
  stem: string;
  type: QuestionType;
  topic: string;
  source_file: string;
  difficulty_target: number;
  cloze_text?: string;
  choices?: { text: string }[];
};

// Grader's structured output.
export type GradeResult = {
  points: { point: string; status: "present" | "missing" | "contradicted" }[];
  verdict: Verdict;
  feedback: string;
  confidence: number; // grader's confidence 0..1
};
