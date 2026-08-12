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
