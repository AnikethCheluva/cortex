import { describe, it, expect } from "vitest";
import {
  newCardState,
  applyReview,
  isDue,
  retrievability,
  intervalDays,
  State,
} from "@/lib/srs/schedule";

const t0 = "2026-07-27T09:00:00.000Z";

describe("fsrs schedule wrapper", () => {
  it("a new card is in New state, due now, retrievability 0", () => {
    const s = newCardState(t0);
    expect(s.state).toBe(State.New);
    expect(isDue(s, t0)).toBe(true);
    expect(retrievability(s, t0)).toBe(0);
    expect(s.reps).toBe(0);
  });

  it("a Good review schedules the card into the future and counts a rep", () => {
    const s = applyReview(newCardState(t0), 3, t0);
    expect(s.state).not.toBe(State.New);
    expect(s.reps).toBeGreaterThanOrEqual(1);
    expect(new Date(s.due).getTime()).toBeGreaterThan(new Date(t0).getTime());
    expect(intervalDays(s)).toBeGreaterThanOrEqual(0);
    expect(isDue(s, t0)).toBe(false); // not due immediately after reviewing
  });

  it("retrievability stays within [0,1] as time passes", () => {
    const s = applyReview(newCardState(t0), 3, t0);
    const later = new Date(new Date(s.due).getTime() + 5 * 86_400_000).toISOString();
    const r = retrievability(s, later);
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(1);
  });

  it("state round-trips through JSON (serializable)", () => {
    const s = applyReview(newCardState(t0), 3, t0);
    const back = JSON.parse(JSON.stringify(s));
    expect(applyReview(back, 3, back.due).reps).toBe(s.reps + 1);
  });
});
