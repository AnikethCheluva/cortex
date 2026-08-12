"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { QuizStats } from "@/lib/srs/stats";
import { getQuizStats } from "@/lib/clientapi";

// The whole recall dashboard now renders with the bklit chart kit (visx +
// motion), lazy-loaded so the kit stays out of the initial bundle and only
// loads when the Overview recall dashboard renders.
const chartFallback = () => <div className="chart-skel" aria-hidden />;
const RetentionTrendChart = dynamic(
  () => import("./RecallCharts").then((m) => m.RetentionTrendChart),
  { ssr: false, loading: chartFallback },
);
const ReviewsVolumeChart = dynamic(
  () => import("./RecallCharts").then((m) => m.ReviewsVolumeChart),
  { ssr: false, loading: chartFallback },
);
const RetentionGauge = dynamic(
  () => import("./RecallCharts").then((m) => m.RetentionGauge),
  { ssr: false, loading: chartFallback },
);
const BarsChart = dynamic(
  () => import("./RecallCharts").then((m) => m.BarsChart),
  { ssr: false, loading: chartFallback },
);

const pct = (x: number | null) => (x == null ? "—" : `${Math.round(x * 100)}%`);
const mmdd = (iso: string) => iso.slice(5).replace("-", "/"); // "2026-07-30" → "07/30"

function Kpi({ n, l }: { n: number | string; l: string }) {
  return (
    <div className="kpi">
      <div className="kpi-n">{n}</div>
      <div className="kpi-l">{l}</div>
    </div>
  );
}

function Tile({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="tile">
      <div className="tile-h">{title}</div>
      {sub && <div className="tile-sub">{sub}</div>}
      <div className="tile-body">{children}</div>
    </div>
  );
}

export function RecallDashboard() {
  const [s, setS] = useState<QuizStats | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    getQuizStats()
      .then(setS)
      .catch((e) => setErr((e as Error).message));
  }, []);

  if (err) return <div className="banner">Couldn’t load stats: {err}</div>;
  if (!s) return <div className="muted" style={{ padding: "24px 0" }}>Loading metrics…</div>;

  const k = s.kpi;
  if (!k.totalCards) {
    return (
      <div className="empty">
        No review history yet. Answer a few days of quizzes and your recall metrics show up here.
      </div>
    );
  }

  return (
    <div className="recall-dash">
      <div className="kpi-row">
        <Kpi n={k.reviewedToday} l="reviewed today" />
        <Kpi n={k.streak} l={k.streak === 1 ? "day streak" : "day streak"} />
        <Kpi n={pct(k.trueRetention30)} l="true retention 30d" />
        <Kpi n={k.matureCount} l="mature cards" />
        <Kpi n={k.dueNow} l="due now" />
      </div>

      <div className="dash-grid">
        <Tile title="True retention" sub="graduated cards, 30d · target 90%">
          <RetentionGauge value={k.trueRetention30} />
        </Tile>
        <Tile title="Retention trend" sub="7-day rolling true retention (%)">
          <RetentionTrendChart points={s.retentionTrend} />
        </Tile>
        <Tile title="Reviews / day" sub="last 3 weeks · green pass, red miss">
          <ReviewsVolumeChart days={s.reviewsByDay} />
        </Tile>
        <Tile title="Due forecast" sub="cards due, next 14 days">
          <BarsChart
            items={s.dueForecast.map((d) => ({ label: mmdd(d.date), value: d.count }))}
          />
        </Tile>
        <Tile title="Memory stability" sub="cards by review interval">
          <BarsChart
            items={s.stabilityHistogram.map((b) => ({ label: b.label, value: b.count }))}
            color="var(--chart-2)"
          />
        </Tile>
        <Tile title="Calibration" sub="predicted confidence vs actual accuracy (%)">
          {s.calibration.bins.length ? (
            <BarsChart
              items={s.calibration.bins.map((b) => ({
                label: `${Math.round(b.p * 100)}%`,
                value: Math.round(b.actual * 100),
              }))}
              color="var(--chart-4)"
            />
          ) : (
            <div className="muted">not enough data yet</div>
          )}
          {s.calibration.brier != null && (
            <div className="cx-cap">Brier score {s.calibration.brier.toFixed(2)} (lower = better)</div>
          )}
        </Tile>
      </div>

      {s.perTopic.length > 0 && (
        <div className="tile">
          <div className="tile-h">Per-topic mastery</div>
          <div className="tile-sub">mean memory stability · accuracy · card count</div>
          <div className="tile-body">
            {s.perTopic.slice(0, 8).map((t) => (
              <div className="topic-row" key={t.topic}>
                <span className="topic-name">{t.topic}</span>
                <div className="bar">
                  <div
                    className="bar-fill"
                    style={{ width: `${Math.min(100, (t.meanStability / 60) * 100)}%` }}
                  />
                </div>
                <span className="topic-meta">
                  {pct(t.accuracy)} · {t.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {s.leeches.length > 0 && (
        <div className="tile">
          <div className="tile-h">Needs a rewrite</div>
          <div className="tile-sub">cards that keep lapsing — split or reword them</div>
          <div className="tile-body">
            {s.leeches.map((l) => (
              <div className="leech" key={l.id}>
                <span className="leech-stem">{l.stem}</span>
                <span className="muted">{l.lapses} lapses</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
