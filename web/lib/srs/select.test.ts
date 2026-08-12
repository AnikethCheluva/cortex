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
