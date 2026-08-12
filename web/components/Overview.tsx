"use client";

import { useMemo } from "react";
import type { VaultData } from "@/lib/types";
import { todayISO, prettyISO } from "@/lib/day";
import {
  currentStreak,
  dailyDateSet,
  lastNDays,
  taskStats,
} from "@/lib/stats";
import { RecallDashboard } from "./RecallDashboard";

type Tab = "today" | "daily" | "wiki" | "tasks" | "log";

export function Overview({
  data,
  onTab,
  openDaily,
}: {
  data: VaultData;
  onTab: (t: Tab) => void;
  openDaily: (stem: string) => void;
}) {
  const today = todayISO();

  const { dates, isoToStem } = useMemo(() => {
    const isoToStem = new Map<string, string>();
    for (const n of data.daily) if (n.date) isoToStem.set(n.date, n.file);
    return { dates: dailyDateSet(data), isoToStem };
  }, [data]);

  const streak = currentStreak(dates, today);
  const stats = useMemo(() => taskStats(data.tasks, today), [data.tasks, today]);
  const strip = useMemo(() => lastNDays(today, 21), [today]);
  const pct = Math.round(stats.completion * 100);
  const wroteToday = dates.has(today);

  return (
    <div>
      <h2 className="section">Overview</h2>

      <div className="ov-grid">
        {/* streak */}
        <div className="card">
          <div className="card-label">Daily streak</div>
          <div className="card-big">
            {streak}
            <span className="card-unit">{streak === 1 ? "day" : "days"}</span>
          </div>
          <div className="heat">
            {strip.map((iso) => {
              const has = dates.has(iso);
              const stem = isoToStem.get(iso);
              return (
                <span
                  key={iso}
                  className={`heat-cell ${has ? "on" : ""} ${iso === today ? "is-today" : ""}`}
                  title={prettyISO(iso)}
                  onClick={() => stem && openDaily(stem)}
                  style={stem ? { cursor: "pointer" } : undefined}
                />
              );
            })}
          </div>
          <div className="card-foot">last 3 weeks · {data.daily.length} notes total</div>
        </div>

        {/* task progress */}
        <div className="card">
          <div className="card-label">Task progress</div>
          <div className="card-big">
            {pct}
            <span className="card-unit">% done</span>
          </div>
          <div className="bar">
            <div className="bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="chips">
            <button className="chip" onClick={() => onTab("tasks")}>
              {stats.open} open
            </button>
            {stats.overdue > 0 && (
              <button className="chip danger" onClick={() => onTab("tasks")}>
                {stats.overdue} overdue
              </button>
            )}
            {stats.high > 0 && (
              <button className="chip warn" onClick={() => onTab("tasks")}>
                {stats.high} high
              </button>
            )}
            {stats.inProgress > 0 && (
              <span className="chip info">{stats.inProgress} in progress</span>
            )}
          </div>
        </div>

        {/* today's note */}
        <div className="card">
          <div className="card-label">Today — {prettyISO(today)}</div>
          <div className="card-mid">
            {wroteToday ? "✓ Note started for today" : "No note yet today"}
          </div>
          <button className="btn btn-primary small" onClick={() => onTab("today")}>
            {wroteToday ? "Open today’s note" : "Start today’s note"}
          </button>
        </div>

        {/* counts */}
        <div className="card">
          <div className="card-label">Knowledge base</div>
          <div className="stat-row">
            <button className="stat" onClick={() => onTab("wiki")}>
              <span className="stat-n">{data.wiki.length}</span>
              <span className="stat-l">wiki pages</span>
            </button>
            <button className="stat" onClick={() => onTab("tasks")}>
              <span className="stat-n">{stats.total}</span>
              <span className="stat-l">tasks</span>
            </button>
            <button className="stat" onClick={() => onTab("daily")}>
              <span className="stat-n">{data.daily.length}</span>
              <span className="stat-l">daily notes</span>
            </button>
          </div>
        </div>
      </div>

      {/* recent activity */}
      <div className="row" style={{ justifyContent: "space-between", marginTop: 8 }}>
        <h3 className="sub">Recent activity</h3>
        <button className="inline-link" onClick={() => onTab("log")}>
          view all →
        </button>
      </div>
      {data.log.slice(0, 5).map((e, i) => (
        <div key={i} className="ov-log">
          <span className="ov-log-date">{e.date}</span>
          {e.action && <span className="log-action">{e.action}</span>}
          <span className="ov-log-text">
            {e.heading.replace(/^\[?\d{4}-\d{2}-\d{2}\]?\s*\|?\s*/, "").replace(/^\w+\s*\|\s*/, "")}
          </span>
        </div>
      ))}

      <h2 className="section">Recall</h2>
      <RecallDashboard />
    </div>
  );
}
