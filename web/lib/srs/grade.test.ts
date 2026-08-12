import { describe, it, expect } from "vitest";
import { normalizeGrade, ratingFromVerdict } from "@/lib/srs/grade";

describe("normalizeGrade", () => {
  it("defaults garbage to an incorrect verdict with mid confidence", () => {
    const g = normalizeGrade({ nonsense: true });
    expect(g.verdict).toBe("incorrect");
    expect(g.confidence).toBe(0.5);
    expect(g.points).toEqual([]);
  });

  it("keeps a valid grade and clamps confidence to [0,1]", () => {
    const g = normalizeGrade({
      points: [{ point: "p1", status: "present" }],
      verdict: "correct",
      feedback: "good",
      confidence: 1.5,
    });
    expect(g.verdict).toBe("correct");
    expect(g.confidence).toBe(1);
    expect(g.points).toHaveLength(1);
  });
});

describe("ratingFromVerdict", () => {
  it("maps verdicts to FSRS grades", () => {
    expect(ratingFromVerdict("correct")).toBe(3);
    expect(ratingFromVerdict("partial")).toBe(2);
    expect(ratingFromVerdict("incorrect")).toBe(1);
  });
});
