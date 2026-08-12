// Pick the day's quiz set: due reviews (most-urgent first) + a capped number of
// new cards, then interleaved by topic so consecutive items differ (spacing +
// discrimination, per the interleaving evidence). Pure — unit-tested.
import type { Card } from "./types";
import { isDue, retrievability, State } from "./schedule";

export type SelectOpts = { max?: number; maxNew?: number; now?: string };

/** Reorder so adjacent cards come from different topics where possible. */
export function interleave(cards: Card[]): Card[] {
  const buckets = new Map<string, Card[]>();
  for (const c of cards) {
    const k = c.topic || "misc";
    (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(c);
  }
  const queues = [...buckets.values()];
  const out: Card[] = [];
  let progress = true;
  while (progress) {
    progress = false;
    for (const q of queues) {
      const next = q.shift();
      if (next) {
        out.push(next);
        progress = true;
      }
    }
  }
  return out;
}

export function selectDaily(cards: Card[], opts: SelectOpts = {}): Card[] {
  const now = opts.now ?? new Date().toISOString();
  const max = opts.max ?? 20;
  const maxNew = opts.maxNew ?? 8;

  const active = cards.filter((c) => !c.suspended);
  const fresh = active.filter((c) => c.srs.state === State.New);
  const due = active
    .filter((c) => c.srs.state !== State.New && isDue(c.srs, now))
    // lowest retrievability = most in danger of being forgotten = review first
    .sort((a, b) => retrievability(a.srs, now) - retrievability(b.srs, now));

  // New cards are bounded by maxNew AND never exceed the daily cap.
  const newCards = fresh.slice(0, Math.min(maxNew, max));
  const reviewSlots = Math.max(0, max - newCards.length);
  return interleave([...due.slice(0, reviewSlots), ...newCards]);
}
