import { describe, it, expect } from "vitest";
import {
  normalizeText,
  jaccard,
  stemLeaksAnswer,
  isDuplicate,
  cardId,
  passedGate,
  buildCard,
  type Candidate,
  type Anno,
} from "@/lib/srs/generate";

const cand: Candidate = {
  stem: "In π0, why is the action head flow-matching?",
  reference_answer: "to model continuous action distributions",
  required_points: ["continuous actions"],
  source_span: "flow matching models continuous action distributions",
  type: "short_answer",
  bloom: "understand",
  difficulty_target: 3,
};
const goodAnno: Anno = {
  answerable_from_span: true,
  reference_correct: true,
  answer_leak: false,
  ambiguous: false,
  trivial: false,
  answerable_without_source: false,
};

describe("pure card-assembly helpers", () => {
  it("normalizeText + jaccard", () => {
    expect(normalizeText("A, B!  c")).toBe("a b c");
    expect(jaccard("alpha beta", "alpha beta")).toBe(1);
    expect(jaccard("alpha beta", "gamma delta")).toBe(0);
  });

  it("stemLeaksAnswer catches a verbatim answer in the stem", () => {
    expect(stemLeaksAnswer("What is photosynthesis? photosynthesis", "photosynthesis")).toBe(true);
    expect(stemLeaksAnswer("What process do plants use for energy?", "photosynthesis")).toBe(false);
  });

  it("isDuplicate matches near-identical stems", () => {
    expect(isDuplicate("what is the capital of france", ["What is the capital of France?"])).toBe(true);
    expect(isDuplicate("unrelated question about robots", ["what is the capital of france"])).toBe(false);
  });

  it("cardId is stable and slug-safe", () => {
    const id = cardId("Why flow-matching?", "robotics");
    expect(id).toBe(cardId("Why flow-matching?", "robotics"));
    expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it("passedGate accepts a clean candidate and rejects flagged ones", () => {
    expect(passedGate(cand, goodAnno).passed).toBe(true);
    expect(passedGate(cand, { ...goodAnno, trivial: true }).passed).toBe(false);
    expect(passedGate(cand, { ...goodAnno, answerable_without_source: true }).passed).toBe(false);
    const leaky: Candidate = { ...cand, stem: "Define entropy: entropy", reference_answer: "entropy" };
    expect(passedGate(leaky, goodAnno).passed).toBe(false); // verbatim leak caught
  });

  it("buildCard produces a New card with provenance + verification", () => {
    const card = buildCard(cand, { source_file: "wiki/pages/pi0.md", topic: "robotics" }, goodAnno, "2026-07-27T00:00:00Z");
    expect(card.srs.state).toBe(0); // New
    expect(card.verification?.passed).toBe(true);
    expect(card.source_file).toBe("wiki/pages/pi0.md");
    expect(card.reference_answer).toBe(cand.reference_answer);
    expect(card.id).toMatch(/^[a-z0-9-]+$/);
  });
});
