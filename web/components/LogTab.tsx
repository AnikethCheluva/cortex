"use client";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { LogEntry } from "@/lib/types";
import type {
  ChangeRecord,
  ChangeSurface,
  DailyChangelog,
} from "@/lib/changelog/types";
import { todayISO } from "@/lib/day";
import { shiftDate } from "@/lib/task-dates";
import { Markdown } from "@/lib/markdown";
import { Icon } from "./Icon";
const labels: Record<ChangeSurface, string> = {
  tasks: "Tasks",
  docs: "Docs",
  daily: "Daily notes",
  wiki: "Wiki",
  recall: "Recall",
  sources: "Sources",
};
const statuses: Record<string, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};
function Summary({ record }: { record: ChangeRecord }) {
  if (record.recall) {
    const run = record.recall;
    return (
      <>
        <p className="change-summary">
          {run.grading.graded} graded · {run.candidates.added} cards added ·{" "}
          {run.selection.total} selected
        </p>
        <details className="change-details">
          <summary>Run details</summary>
          <dl>
            <dt>Candidates</dt>
            <dd>
              {run.candidates.received} received, {run.candidates.rejected}{" "}
              rejected, {run.candidates.duplicates} duplicates
            </dd>
            <dt>Selection</dt>
            <dd>
              {run.selection.due} due reviews, {run.selection.new} new cards
            </dd>
            <dt>Bank</dt>
            <dd>
              {run.bankSize} cards, {run.pendingAnswers} pending answers
            </dd>
          </dl>
          {run.candidates.decisions.length > 0 && (
            <ul>
              {run.candidates.decisions.map((decision, index) => (
                <li key={index}>
                  {decision.stem}: {decision.outcome}
                  {decision.reason && ` (${decision.reason})`}
                </li>
              ))}
            </ul>
          )}
          {run.grading.reviews.map((review) => (
            <div
              className="change-review"
              key={`${review.cardId}:${review.answeredAt}`}
            >
              <strong>{review.cardId}</strong>
              <span>
                {review.verdict} · rating {review.rating}
              </span>
              <span>
                Next review: {new Date(review.dueAfter).toLocaleDateString()}
              </span>
            </div>
          ))}
          <p>Selected cards: {run.selection.cardIds.join(", ") || "none"}</p>
        </details>
      </>
    );
  }
  return (
    <>
      {record.action === "status_changed" && (
        <p className="change-summary">
          {statuses[String(record.before?.status)] ?? record.before?.status} →{" "}
          {statuses[String(record.after?.status)] ?? record.after?.status}
        </p>
      )}
      {record.noteDate && (
        <p className="change-summary">Note date: {record.noteDate}</p>
      )}
      <details className="change-details">
        <summary>{record.path}</summary>
        <dl>
          {record.changedFields
            ?.filter((field) => field !== "body")
            .map((field) => (
              <div key={field}>
                <dt>{field.replaceAll("_", " ")}</dt>
                <dd>
                  {String(record.before?.[field] ?? "—")} →{" "}
                  {String(record.after?.[field] ?? "—")}
                </dd>
              </div>
            ))}
        </dl>
        {record.changedFields?.includes("body") && <p>Content changed.</p>}
      </details>
    </>
  );
}
export function LogTab({
  entries,
  changes = [],
  openTask,
  openDaily,
}: {
  entries: LogEntry[];
  changes?: DailyChangelog[];
  openTask?: (id: string) => void;
  openDaily?: (stem: string) => void;
}) {
  const [date, setDate] = useState(todayISO());
  const [surface, setSurface] = useState<ChangeSurface | "all">("all");
  const [query, setQuery] = useState("");
  const [legacy, setLegacy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [loaded, setLoaded] = useState<{
    date: string;
    records: ChangeRecord[];
  } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const search = useDeferredValue(query.trim().toLowerCase());
  useEffect(() => {
    if (legacy) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/changelog?date=${date}&t=${Date.now()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load changelog");
        return response.json() as Promise<DailyChangelog>;
      })
      .then((day) => {
        if (!controller.signal.aborted)
          setLoaded({ date, records: day.records });
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [date, revision, legacy]);
  const records =
    loaded?.date === date
      ? loaded.records
      : (changes.find((day) => day.date === date)?.records ?? []);
  const filtered = useMemo(
    () =>
      records
        .filter(
          (record) =>
            (surface === "all" || record.surface === surface) &&
            (!search ||
              `${record.title} ${record.path} ${record.action}`
                .toLowerCase()
                .includes(search)),
        )
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [records, surface, search],
  );
  return (
    <section className="changelog-workspace">
      <div className="page-heading">
        <h1>Activity</h1>
        <button
          className="btn"
          aria-pressed={legacy}
          onClick={() => setLegacy((value) => !value)}
        >
          {legacy ? "Changelog" : "Legacy log"}
        </button>
      </div>
      {legacy ? (
        entries.length === 0 ? (
          <div className="empty">No log entries.</div>
        ) : (
          entries.map((entry, index) => (
            <div className="log-entry" key={index}>
              <div className="log-head">
                <span className="log-date">{entry.date}</span>
                <span className="log-action">{entry.action}</span>
              </div>
              <Markdown body={entry.body} />
            </div>
          ))
        )
      ) : (
        <>
          <div className="changelog-toolbar">
            <button
              className="icon-button"
              aria-label="Previous changelog day"
              onClick={() => setDate(shiftDate(date, -1))}
            >
              <Icon name="chevron" style={{ transform: "rotate(180deg)" }} />
            </button>
            <input
              type="date"
              aria-label="Changelog date"
              value={date}
              onChange={(event) => {
                if (event.target.value) setDate(event.target.value);
              }}
            />
            <button
              className="icon-button"
              aria-label="Next changelog day"
              onClick={() => setDate(shiftDate(date, 1))}
            >
              <Icon name="chevron" />
            </button>
            <button className="btn" onClick={() => setDate(todayISO())}>
              Today
            </button>
            <button
              className="icon-button"
              aria-label="Refresh changelog"
              disabled={loading}
              onClick={() => setRevision((n) => n + 1)}
            >
              <Icon name="refresh" />
            </button>
          </div>
          <div className="changelog-filters">
            <label>
              Surface
              <select
                aria-label="Changelog surface"
                value={surface}
                onChange={(event) =>
                  setSurface(event.target.value as ChangeSurface | "all")
                }
              >
                <option value="all">All</option>
                {Object.entries(labels).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <input
              type="search"
              aria-label="Search changelog"
              placeholder="Search changes…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          {error && (
            <div className="banner" role="alert">
              {error}
              <button
                className="quiet-button"
                onClick={() => setRevision((n) => n + 1)}
              >
                Retry
              </button>
            </div>
          )}
          <p className="archive-result-count" role="status">
            {loading ? "Loading…" : `${filtered.length} changes`}
          </p>
          {filtered.map((record) => (
            <article className="change-record" key={record.id}>
              <header>
                <span>
                  {labels[record.surface]} ·{" "}
                  {record.action.replaceAll("_", " ")}
                </span>
                <time dateTime={record.timestamp}>
                  {new Date(record.timestamp).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </time>
              </header>
              <h2>{record.title}</h2>
              <Summary record={record} />
              <footer>
                <span>{record.source}</span>
                {record.surface === "tasks" &&
                  record.action !== "deleted" &&
                  openTask && (
                    <button
                      className="quiet-button"
                      onClick={() =>
                        openTask(
                          record.path.split("/").pop()!.replace(/\.md$/i, ""),
                        )
                      }
                    >
                      Open task <Icon name="arrow" size={14} />
                    </button>
                  )}
                {record.surface === "daily" &&
                  record.action !== "deleted" &&
                  openDaily && (
                    <button
                      className="quiet-button"
                      onClick={() =>
                        openDaily(
                          record.path.split("/").pop()!.replace(/\.md$/i, ""),
                        )
                      }
                    >
                      Open note <Icon name="arrow" size={14} />
                    </button>
                  )}
              </footer>
            </article>
          ))}
          {!loading && !filtered.length && !error && (
            <div className="empty">No changes for this date and filter.</div>
          )}
        </>
      )}
    </section>
  );
}
