"use client";

// The Overview is a widget board. Which widgets appear, and in what order, is
// user preference (Settings → Overview widgets) — this file owns the registry
// and each widget's rendering; lib/settings.ts owns the order/visibility state.
import { useMemo } from "react";
import type { VaultData } from "@/lib/types";
import { todayISO, prettyISO } from "@/lib/day";
import { currentStreak, dailyDateSet, lastNDays, taskStats } from "@/lib/stats";
import { useSettings, WIDGET_META, type TabKey, type WidgetKey } from "@/lib/settings";
import { RecallDashboard } from "./RecallDashboard";

export function Overview({
  data,
  onTab,
  openDaily,
}: {
  data: VaultData;
  onTab: (t: TabKey) => void;
  openDaily: (stem: string) => void;
}) {
  const settings = useSettings();
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

  const upcoming = useMemo(
    () =>
      [...(data.planned ?? [])]
        .filter((p) => p.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 4),
    [data.planned, today],
  );
  const recentDocs = useMemo(
    () => [...(data.notes ?? [])].sort((a, b) => (b.updated || "").localeCompare(a.updated || "")).slice(0, 4),
    [data.notes],
  );

  const widget = (key: WidgetKey) => {
    switch (key) {
      case "streak":
        return (
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
        );

      case "tasks":
        return (
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
              {stats.inProgress > 0 && <span className="chip info">{stats.inProgress} in progress</span>}
            </div>
          </div>
        );

      case "today":
        return (
          <div className="card">
            <div className="card-label">Today — {prettyISO(today)}</div>
            <div className="card-mid">
              {wroteToday ? "✓ Note started for today" : "No note yet today"}
            </div>
            <button className="btn btn-primary small" onClick={() => onTab("today")}>
              {wroteToday ? "Open today’s note" : "Start today’s note"}
            </button>
          </div>
        );

      case "knowledge":
        return (
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
        );

      case "planned":
        return (
          <div className="card">
            <div className="card-label">Upcoming deliverables</div>
            {upcoming.length === 0 ? (
              <div className="card-mid muted">Nothing scoped yet — the ingest plans these.</div>
            ) : (
              <ul className="mini-list">
                {upcoming.map((p) => (
                  <li key={p.id} className="mini-row">
                    <span className="mini-date">{p.date.slice(5)}</span>
                    <span className="mini-text" title={p.note || p.title}>
                      {p.title}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <button className="btn small" onClick={() => onTab("calendar")}>
              Open calendar
            </button>
          </div>
        );

      case "recentDocs":
        return (
          <div className="card">
            <div className="card-label">Recent documents</div>
            {recentDocs.length === 0 ? (
              <div className="card-mid muted">No documents yet.</div>
            ) : (
              <ul className="mini-list">
                {recentDocs.map((d) => (
                  <li key={d.slug} className="mini-row">
                    <span className="mini-date">{(d.updated || "").slice(5)}</span>
                    <span className="mini-text" title={d.preview}>
                      {d.title || "Untitled document"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <button className="btn small" onClick={() => onTab("docs")}>
              Open docs
            </button>
          </div>
        );

      case "activity":
        return (
          <>
            <div className="row" style={{ justifyContent: "space-between" }}>
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
                  {e.heading
                    .replace(/^\[?\d{4}-\d{2}-\d{2}\]?\s*\|?\s*/, "")
                    .replace(/^\w+\s*\|\s*/, "")}
                </span>
              </div>
            ))}
          </>
        );

      case "recall":
        return (
          <>
            <h2 className="section">Recall</h2>
            <RecallDashboard />
          </>
        );
    }
  };

  const visible = settings.widgetOrder.filter((k) => !settings.hiddenWidgets.includes(k));

  return (
    <div>
      <h2 className="section">Overview</h2>

      {visible.length === 0 ? (
        <div className="empty">
          Every widget is hidden. Turn some back on in <b>Settings → Overview widgets</b>.
        </div>
      ) : (
        <div className="ov-grid" data-density={settings.density}>
          {visible.map((k) => (
            <div key={k} className={WIDGET_META[k].wide ? "ov-slot ov-wide" : "ov-slot"}>
              {widget(k)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
