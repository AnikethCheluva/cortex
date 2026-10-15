// Pick the day's quiz set: due reviews (most-urgent first) + a capped number of
// new cards, then interleaved by topic so consecutive items differ (spacing +
// discrimination, per the interleaving evidence). Pure — unit-tested.
import type { Card } from "./types";
import { isDue, retrievability, State } from "./schedule";

export type SelectOpts = {
  max?: number;
  maxNew?: number;
  now?: string;
  /** Card ids served on the previous day, so today can avoid repeating them. */
  exclude?: string[];
};

/** Days since the epoch for a date — the rotation key for new-card selection. */
function dayNumber(nowISO: string): number {
  const localDay = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(nowISO));
  const t = Date.parse(`${localDay}T00:00:00Z`);
  return Number.isNaN(t) ? 0 : Math.floor(t / 86_400_000);
}

/** Reorder so adjacent cards come from different topics where possible. */
export function interleave(cards: Card[]): Card[] {
  const buckets = new Map<string, Card[]>();
  for (const c of cards) {
    const k = c.topic || "misc";
    (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(c);
  }
  const out: Card[] = [];
  let previous = "";
  while (buckets.size) {
    const ranked = [...buckets.entries()].sort((a, b) => b[1].length - a[1].length);
    const [topic, queue] = ranked.find(([key]) => key !== previous) ?? ranked[0];
    out.push(queue.shift()!);
    previous = topic;
    if (!queue.length) buckets.delete(topic);
  }
  return out;
}

export function selectDaily(cards: Card[], opts: SelectOpts = {}): Card[] {
  const now = opts.now ?? new Date().toISOString();
  const limit = (value: number | undefined, fallback: number) =>
    value === undefined || !Number.isFinite(value) ? fallback : Math.max(0, Math.floor(value));
  const max = limit(opts.max, 20);
  const maxNew = limit(opts.maxNew, 8);

  const active = cards.filter((c) => !c.suspended);
  const fresh = active.filter((c) => c.srs.state === State.New);
  const due = active
    .filter((c) => c.srs.state !== State.New && isDue(c.srs, now))
    // lowest retrievability = most in danger of being forgotten = review first
    .sort((a, b) => retrievability(a.srs, now) - retrievability(b.srs, now));

  // Reviews come FIRST, then new cards fill whatever's left (bounded by maxNew).
  // This is deliberate backlog handling: a due card — something you already
  // learned and are about to forget — matters more than new material. When you
  // miss days, unanswered/overdue reviews pile up (they're never penalized; a
  // skipped review just stays due and resurfaces here, most-at-risk first). By
  // giving reviews the daily cap first, a backlog GATES new cards — introducing
  // new material while you're behind only deepens the hole — and the introduction
  // of new cards resumes automatically once you've caught up.
  const skip = new Set(opts.exclude ?? []);

  // Due reviews still come first — a card you already learned and are about to
  // forget matters more than new material, and a backlog therefore gates new
  // cards rather than piling on top of them.
  //
  // Rotation applies only to new material. An unanswered due review keeps its
  // urgency; yesterday's appearance must never let new cards displace it.

  // New cards rotate by date rather than always taking the head of the pool.
  // A New card only leaves the New state once an answer is graded, so while
  // grading lags `fresh` never changes and a fixed prefix hands back the very
  // same questions day after day. Walking a window through the pool keeps the
  // deck moving on its own, and is deterministic per day so re-running an
  // ingest is idempotent.
  const freshPool = fresh.filter((c) => !skip.has(c.id));
  const usable = freshPool.length ? freshPool : fresh;
  const start = usable.length ? (dayNumber(now) * Math.max(1, maxNew)) % usable.length : 0;
  const rotatedNew = [...usable.slice(start), ...usable.slice(0, start)];

  const picked: Card[] = [];
  const take = (list: Card[], limit: number) => {
    for (const c of list) {
      if (picked.length >= max || limit <= 0) return;
      if (picked.some((p) => p.id === c.id)) continue;
      picked.push(c);
      limit--;
    }
  };

  take(due, max);
  take(interleave(rotatedNew), Math.min(maxNew, Math.max(0, max - picked.length)));

  return interleave(picked);
}
