// Derived recall/learning metrics for the dashboard, computed purely from the
// card bank + review log. Follows the research: headline metric is *true
// retention* on graduated cards (not raw pass %), plus stability growth, mature
// count, due-forecast, and confidence calibration. Pure — unit-tested.
import type { Card, Review } from "./types";

// FSRS state codes (kept local so this stays dependency-free and runs in the
// web app without pulling in ts-fsrs — only the ingest script does FSRS math).
const STATE = { New: 0, Learning: 1, Review: 2, Relearning: 3 } as const;

/** Cards answerable right now: new, or past their due date. Pure date compare. */
export function dueCount(cards: Card[], nowISO: string): number {
  const now = new Date(nowISO).getTime();
  return cards.filter(
    (c) => !c.suspended && (c.srs.state === STATE.New || new Date(c.srs.due).getTime() <= now),
  ).length;
}

const MATURE_DAYS = 21; // convention: interval ≥ 3 weeks = "mature"
// A review counts toward true retention once the card is past first exposure
// (reps ≥ 2 post-review ≈ a genuine recall attempt, not initial learning).
const GRADUATED_REPS = 2;

const dayOf = (iso: string) => iso.slice(0, 10);
const isPass = (r: Review) => r.verdict === "correct";
const isGraduated = (r: Review) => r.reps >= GRADUATED_REPS;

function dayList(nowISO: string, n: number): string[] {
  const [y, m, d] = dayOf(nowISO).split("-").map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push(new Date(Date.UTC(y, m - 1, d - i)).toISOString().slice(0, 10));
  }
  return out;
}
function dayForward(nowISO: string, n: number): string[] {
  const [y, m, d] = dayOf(nowISO).split("-").map(Number);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10));
  }
  return out;
}

export type QuizStats = {
  kpi: {
    reviewedToday: number;
    streak: number;
    trueRetention30: number | null; // null = not enough graduated reviews yet
    matureCount: number;
    dueNow: number;
    totalCards: number;
  };
  reviewsByDay: { date: string; pass: number; fail: number }[];
  retentionTrend: { day: string; retention: number; n: number }[]; // 7-day rolling
  stabilityHistogram: { label: string; count: number }[];
  dueForecast: { date: string; count: number }[];
  calibration: { bins: { p: number; actual: number; n: number }[]; brier: number | null };
  perTopic: { topic: string; meanStability: number; accuracy: number | null; count: number }[];
  leeches: { id: string; stem: string; topic: string; lapses: number }[];
};

export function computeStats(
  bank: Record<string, Card>,
  reviews: Review[],
  nowISO: string,
  dueNow: number,
): QuizStats {
  const cards = Object.values(bank);
  const today = dayOf(nowISO);
  const graduated = reviews.filter(isGraduated);

  // ---- KPI ----
  const reviewedToday = reviews.filter((r) => dayOf(r.ts) === today).length;
  const daysWithReviews = new Set(reviews.map((r) => dayOf(r.ts)));
  let streak = 0;
  for (const d of dayList(nowISO, 400).reverse()) {
    if (daysWithReviews.has(d)) streak++;
    else if (d !== today) break; // today not-yet-done doesn't break the streak
  }
  const cutoff30 = dayList(nowISO, 30)[0];
  const grad30 = graduated.filter((r) => dayOf(r.ts) >= cutoff30);
  const trueRetention30 = grad30.length ? grad30.filter(isPass).length / grad30.length : null;
  const matureCount = cards.filter(
    (c) => c.srs.state === STATE.Review && c.srs.stability >= MATURE_DAYS,
  ).length;

  // ---- reviews per day (last 21) ----
  const byDay = new Map<string, { pass: number; fail: number }>();
  for (const r of reviews) {
    const k = dayOf(r.ts);
    const b = byDay.get(k) ?? { pass: 0, fail: 0 };
    isPass(r) ? b.pass++ : b.fail++;
    byDay.set(k, b);
  }
  const reviewsByDay = dayList(nowISO, 21).map((date) => ({
    date,
    pass: byDay.get(date)?.pass ?? 0,
    fail: byDay.get(date)?.fail ?? 0,
  }));

  // ---- true-retention trend (7-day rolling over graduated reviews) ----
  const gradByDay = new Map<string, { pass: number; n: number }>();
  for (const r of graduated) {
    const k = dayOf(r.ts);
    const b = gradByDay.get(k) ?? { pass: 0, n: 0 };
    if (isPass(r)) b.pass++;
    b.n++;
    gradByDay.set(k, b);
  }
  const trendDays = dayList(nowISO, 28);
  const retentionTrend = trendDays.map((day, i) => {
    let pass = 0,
      n = 0;
    for (let j = Math.max(0, i - 6); j <= i; j++) {
      const b = gradByDay.get(trendDays[j]);
      if (b) {
        pass += b.pass;
        n += b.n;
      }
    }
    return { day, retention: n ? pass / n : 0, n };
  });

  // ---- stability histogram (current cards) ----
  const bucketDefs: [string, (s: number) => boolean][] = [
    ["<1d", (s) => s < 1],
    ["1–7d", (s) => s >= 1 && s < 7],
    ["1–3w", (s) => s >= 7 && s < 21],
    ["3w–3mo", (s) => s >= 21 && s < 90],
    ["3mo+", (s) => s >= 90],
  ];
  const stabilityHistogram = bucketDefs.map(([label, test]) => ({
    label,
    count: cards.filter((c) => c.srs.state !== STATE.New && test(c.srs.stability)).length,
  }));

  // ---- due forecast (next 14 days) ----
  const dueByDay = new Map<string, number>();
  for (const c of cards) {
    if (c.suspended || c.srs.state === STATE.New) continue;
    const k = dayOf(c.srs.due);
    dueByDay.set(k, (dueByDay.get(k) ?? 0) + 1);
  }
  const forwardDays = dayForward(nowISO, 14);
  const dueForecast = forwardDays.map((date, i) => {
    // everything overdue collapses onto today
    const count =
      i === 0
        ? [...dueByDay].reduce((n, [d, c]) => (d <= date ? n + c : n), 0)
        : dueByDay.get(date) ?? 0;
    return { date, count };
  });

  // ---- calibration (self-reported confidence vs actual correctness) ----
  const conf = reviews.filter((r) => typeof r.confidence === "number");
  const binN = 5;
  const binAgg = Array.from({ length: binN }, () => ({ p: 0, actual: 0, n: 0 }));
  let brierSum = 0;
  for (const r of conf) {
    const c = Math.min(0.999, Math.max(0, r.confidence));
    const o = isPass(r) ? 1 : 0;
    brierSum += (c - o) ** 2;
    const bi = Math.min(binN - 1, Math.floor(c * binN));
    binAgg[bi].p += c;
    binAgg[bi].actual += o;
    binAgg[bi].n++;
  }
  const calibration = {
    bins: binAgg
      .filter((b) => b.n > 0)
      .map((b) => ({ p: b.p / b.n, actual: b.actual / b.n, n: b.n })),
    brier: conf.length ? brierSum / conf.length : null,
  };

  // ---- per-topic mastery ----
  const topics = new Map<string, { stab: number[]; pass: number; n: number }>();
  for (const c of cards) {
    const t = topics.get(c.topic) ?? { stab: [], pass: 0, n: 0 };
    if (c.srs.state !== STATE.New) t.stab.push(c.srs.stability);
    topics.set(c.topic, t);
  }
  for (const r of graduated) {
    const t = topics.get(r.topic);
    if (!t) continue;
    if (isPass(r)) t.pass++;
    t.n++;
  }
  const perTopic = [...topics.entries()]
    .map(([topic, t]) => ({
      topic,
      meanStability: t.stab.length ? t.stab.reduce((a, b) => a + b, 0) / t.stab.length : 0,
      accuracy: t.n ? t.pass / t.n : null,
      count: t.stab.length,
    }))
    .sort((a, b) => b.count - a.count);

  // ---- leeches (repeatedly-lapsing cards to rewrite/split) ----
  const leeches = cards
    .filter((c) => c.srs.lapses >= 8)
    .sort((a, b) => b.srs.lapses - a.srs.lapses)
    .slice(0, 10)
    .map((c) => ({ id: c.id, stem: c.stem, topic: c.topic, lapses: c.srs.lapses }));

  return {
    kpi: {
      reviewedToday,
      streak,
      trueRetention30,
      matureCount,
      dueNow: dueNow,
      totalCards: cards.length,
    },
    reviewsByDay,
    retentionTrend,
    stabilityHistogram,
    dueForecast,
    calibration,
    perTopic,
    leeches,
  };
}
