import { describe, it, expect } from "vitest";
import { selectDaily, interleave } from "@/lib/srs/select";
import { dueCount } from "@/lib/srs/stats";
import { newCardState, applyReview } from "@/lib/srs/schedule";
import type { Card, CardState } from "@/lib/srs/types";

const t0 = "2026-07-27T09:00:00.000Z";

function card(id: string, topic: string, srs: CardState): Card {
  return {
    id,
    created: "2026-07-27",
    source_file: "x.md",
    source_span: "",
    topic,
    tags: [],
    gen_model: "m",
    type: "short_answer",
    bloom: "remember",
    difficulty_target: 2,
    stem: id,
    reference_answer: "",
    required_points: [],
    srs,
  };
}

const newCard = (id: string, topic = "t") => card(id, topic, newCardState(t0));

// A graduated card whose due date is in the past (an overdue review) — the shape
// unanswered/missed cards take, so they resurface in selectDaily.
const dueCard = (id: string, topic = "t"): Card =>
  card(id, topic, {
    due: "2026-07-20T09:00:00.000Z", // before t0 → overdue
    stability: 5,
    difficulty: 5,
    elapsed_days: 7,
    scheduled_days: 5,
    learning_steps: 0,
    reps: 2,
    lapses: 0,
    state: 2, // Review
    last_review: "2026-07-15T09:00:00.000Z",
  });

describe("selectDaily", () => {
  it("caps the total set at `max`", () => {
    const cards = Array.from({ length: 30 }, (_, i) => newCard(`c${i}`));
    expect(selectDaily(cards, { max: 5, now: t0 }).length).toBe(5);
  });

  it("limits how many NEW cards appear", () => {
    const cards = Array.from({ length: 20 }, (_, i) => newCard(`c${i}`));
    // no due reviews exist, so only maxNew new cards are served
    expect(selectDaily(cards, { max: 20, maxNew: 3, now: t0 }).length).toBe(3);
  });

  it("skips suspended cards", () => {
    const c = newCard("a");
    c.suspended = true;
    expect(selectDaily([c], { now: t0 })).toEqual([]);
  });

  it("gates NEW cards behind a review backlog (missed/unanswered days)", () => {
    const dues = Array.from({ length: 10 }, (_, i) => dueCard(`d${i}`));
    const news = Array.from({ length: 10 }, (_, i) => newCard(`n${i}`));
    const out = selectDaily([...dues, ...news], { max: 5, maxNew: 8, now: t0 });
    // backlog (10 due) fills the cap → all reviews, zero new
    expect(out.length).toBe(5);
    expect(out.every((c) => c.id.startsWith("d"))).toBe(true);
  });

  it("resumes new cards once the backlog fits under the cap", () => {
    const dues = Array.from({ length: 2 }, (_, i) => dueCard(`d${i}`));
    const news = Array.from({ length: 10 }, (_, i) => newCard(`n${i}`));
    const out = selectDaily([...dues, ...news], { max: 5, maxNew: 8, now: t0 });
    expect(out.length).toBe(5);
    expect(out.filter((c) => c.id.startsWith("d")).length).toBe(2); // both reviews
    expect(out.filter((c) => c.id.startsWith("n")).length).toBe(3); // leftover slots
  });
});

describe("interleave", () => {
  it("separates adjacent same-topic cards", () => {
    const out = interleave([newCard("a1", "A"), newCard("a2", "A"), newCard("b1", "B")]);
    expect(out.map((c) => c.topic)).toEqual(["A", "B", "A"]);
  });
});

describe("dueCount", () => {
  it("counts new cards plus past-due reviews, not future ones", () => {
    const future = card("f", "t", applyReview(newCardState(t0), 3, t0)); // due in the future
    expect(dueCount([newCard("n"), future], t0)).toBe(1);
  });
});

describe("a stalled deck must not repeat itself", () => {
  // The 2026-08/09 regression: 300+ New cards, nothing graded, so `fresh` never
  // changed and a fixed prefix served byte-identical quizzes for a week — the
  // daily notes looked duplicated.
  const stalled = Array.from({ length: 300 }, (_, i) => newCard(`n${i}`, `topic${i % 7}`));

  const ids = (day: string) =>
    selectDaily(stalled, { max: 20, maxNew: 8, now: `${day}T09:00:00.000Z` })
      .map((c) => c.id)
      .sort()
      .join(",");

  it("serves a different set on consecutive days", () => {
    expect(ids("2026-09-01")).not.toBe(ids("2026-09-02"));
    expect(ids("2026-09-02")).not.toBe(ids("2026-09-03"));
    expect(ids("2026-09-03")).not.toBe(ids("2026-09-04"));
  });

  it("stays deterministic within a day, so re-running an ingest is idempotent", () => {
    expect(ids("2026-09-01")).toBe(ids("2026-09-01"));
  });

  it("works through the pool rather than cycling a handful of cards", () => {
    const seen = new Set<string>();
    for (let d = 1; d <= 20; d++) {
      const day = `2026-09-${String(d).padStart(2, "0")}`;
      for (const id of ids(day).split(",")) seen.add(id);
    }
    // 20 days x 8 new cards: a fixed prefix would have shown only 8 distinct.
    expect(seen.size).toBeGreaterThan(100);
  });

  it("can be told to avoid yesterday's cards outright", () => {
    const yesterday = selectDaily(stalled, { max: 20, maxNew: 8, now: "2026-09-01T09:00:00.000Z" });
    const today = selectDaily(stalled, {
      max: 20,
      maxNew: 8,
      now: "2026-09-02T09:00:00.000Z",
      exclude: yesterday.map((c) => c.id),
    });
    const overlap = today.filter((c) => yesterday.some((y) => y.id === c.id));
    expect(overlap).toHaveLength(0);
  });

  it("still serves cards when the exclude list would starve the pool", () => {
    const tiny = Array.from({ length: 5 }, (_, i) => newCard(`t${i}`));
    const out = selectDaily(tiny, {
      max: 20,
      maxNew: 8,
      now: "2026-09-02T09:00:00.000Z",
      exclude: tiny.map((c) => c.id), // everything excluded
    });
    expect(out.length).toBeGreaterThan(0);
  });

  it("keeps due reviews in every set — rotation only moves NEW cards", () => {
    const dues = Array.from({ length: 3 }, (_, i) => dueCard(`d${i}`));
    for (const day of ["2026-09-01", "2026-09-02", "2026-09-03"]) {
      const out = selectDaily([...dues, ...stalled], {
        max: 20,
        maxNew: 8,
        now: `${day}T09:00:00.000Z`,
      });
      expect(out.filter((c) => c.id.startsWith("d"))).toHaveLength(3);
    }
  });
});
