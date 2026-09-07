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
  const t = Date.parse(`${nowISO.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(t) ? 0 : Math.floor(t / 86_400_000);
}

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
  // The one refinement: a due card served YESTERDAY and left unanswered steps
  // aside for a day if there is other material to show. Re-serving something you
  // just skipped teaches nothing, and when the answer→grade loop stalls it is
  // what makes every daily note come out identical. The card stays due and
  // returns; it simply doesn't monopolise the quiz.
  const dueFresh = due.filter((c) => !skip.has(c.id));
  const dueRepeat = due.filter((c) => skip.has(c.id));

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

  take(dueFresh, max); // 1. reviews you haven't just seen
  take(rotatedNew, Math.min(maxNew, Math.max(0, max - picked.length))); // 2. new material
  take(dueRepeat, max - picked.length); // 3. yesterday's unanswered, to top up

  return interleave(picked);
}
