// Thin, serialization-friendly wrapper over ts-fsrs (FSRS scheduler). We keep
// card memory-state as plain ISO-string JSON (lib/srs/types CardState) and only
// touch ts-fsrs at the boundary. ts-fsrs fuzz is seeded from the card, so
// scheduling stays deterministic — safe for replaying the review log.
import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  State,
  type Card as FsrsCard,
  type CardInput,
  type FSRS,
  type Grade,
} from "ts-fsrs";
import type { CardState, Rating } from "./types";

// Target retention: recall probability at which a card becomes "due". 0.90 is
// the evidence-backed default (desirable-difficulty sweet spot).
const TARGET = Number(process.env.QUIZ_TARGET_RETENTION || "0.9");

let _f: FSRS | null = null;
function engine(): FSRS {
  return (_f ??= fsrs(generatorParameters({ enable_fuzz: true, request_retention: TARGET })));
}

function serialize(c: FsrsCard): CardState {
  return {
    due: c.due.toISOString(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    last_review: c.last_review ? new Date(c.last_review).toISOString() : undefined,
  };
}

// CardInput accepts string dates + numeric state, so CardState maps straight in.
function toInput(s: CardState): CardInput {
  return {
    due: s.due,
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: s.elapsed_days,
    scheduled_days: s.scheduled_days,
    learning_steps: s.learning_steps,
    reps: s.reps,
    lapses: s.lapses,
    state: s.state as State,
    last_review: s.last_review ?? null,
  };
}

export function newCardState(nowISO: string): CardState {
  return serialize(createEmptyCard(nowISO));
}

/** Apply one graded review, returning the next memory state. */
export function applyReview(s: CardState, rating: Rating, nowISO: string): CardState {
  return serialize(engine().next(toInput(s), nowISO, rating as Grade).card);
}

/** Probability of recalling the card right now (0..1). New cards → 0. */
export function retrievability(s: CardState, nowISO: string): number {
  if (s.state === State.New) return 0;
  return engine().get_retrievability(toInput(s), nowISO, false);
}

export function isDue(s: CardState, nowISO: string): boolean {
  return new Date(s.due).getTime() <= new Date(nowISO).getTime();
}

/** Days a card has to wait after this review (for "next in Nd" UI). */
export function intervalDays(s: CardState): number {
  return Math.max(0, Math.round(s.scheduled_days));
}

export { State };
