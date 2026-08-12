"use client";

import type { LogEntry } from "@/lib/types";
import { Markdown } from "@/lib/markdown";

export function LogTab({ entries }: { entries: LogEntry[] }) {
  return (
    <div>
      <h2 className="section">Activity</h2>
      {entries.length === 0 ? (
        <div className="empty">No log entries yet.</div>
      ) : (
        <div style={{ marginTop: 16 }}>
          {entries.map((e, i) => (
            <div key={i} className="log-entry">
              <div className="log-head">
                {e.date && <span className="log-date">{e.date}</span>}
                {e.action && <span className="log-action">{e.action}</span>}
              </div>
              {e.body && <Markdown body={e.body} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
