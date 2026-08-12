import { describe, it, expect } from "vitest";
import { computeStats } from "@/lib/srs/stats";
import { newCardState, applyReview } from "@/lib/srs/schedule";
import type { Card, CardBank, Review } from "@/lib/srs/types";

const now = "2026-07-27T12:00:00.000Z";
const t0 = "2026-07-20T09:00:00.000Z";

function card(id: string, topic: string): Card {
  return {
    id,
    created: "2026-07-20",
    source_file: `wiki/pages/${id}.md`,
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
    srs: applyReview(applyReview(newCardState(t0), 3, t0), 3, "2026-07-24T09:00:00.000Z"),
  };
}

function review(over: Partial<Review>): Review {
  return {
    card_id: "a",
    ts: now,
    rating: 3,
    verdict: "correct",
    confidence: 0.8,
    user_answer: "",
    auto: true,
    topic: "alpha",
    stability: 10,
    difficulty: 5,
    scheduled_days: 10,
    reps: 3,
    state: 2,
    ...over,
  };
}

describe("computeStats", () => {
  const bank: CardBank = { a: card("a", "alpha"), b: card("b", "beta") };
  const reviews: Review[] = [
    review({ ts: now, verdict: "correct", confidence: 0.8, reps: 3 }),
    review({ ts: now, verdict: "incorrect", confidence: 0.9, reps: 4 }),
    review({ ts: "2026-07-26T10:00:00.000Z", verdict: "correct", confidence: 0.5, reps: 1, topic: "beta" }),
  ];
  const s = computeStats(bank, reviews, now, 2);

  it("counts today's reviews and the streak", () => {
    expect(s.kpi.reviewedToday).toBe(2);
    expect(s.kpi.streak).toBe(2); // today + yesterday
    expect(s.kpi.dueNow).toBe(2);
    expect(s.kpi.totalCards).toBe(2);
  });

  it("computes true retention over graduated (reps ≥ 2) reviews only", () => {
    // graduated: the two 'today' reviews (reps 3,4) → 1 correct of 2 = 0.5
    expect(s.kpi.trueRetention30).toBeCloseTo(0.5, 5);
  });

  it("produces fixed-length time series and a calibration score", () => {
    expect(s.reviewsByDay).toHaveLength(21);
    expect(s.dueForecast).toHaveLength(14);
    expect(s.calibration.brier).not.toBeNull();
    expect(s.calibration.bins.length).toBeGreaterThan(0);
  });

  it("breaks mastery down by topic", () => {
    expect(s.perTopic.map((t) => t.topic).sort()).toEqual(["alpha", "beta"]);
  });
});
