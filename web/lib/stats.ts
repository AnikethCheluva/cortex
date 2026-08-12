// Pure derived metrics for the Overview tab: daily-note streak + task stats.
import type { Task, VaultData } from "./types";

/** Step a YYYY-MM-DD date by whole days (UTC math avoids any tz drift). */
function addDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

/** Set of ISO dates that have a daily note. */
export function dailyDateSet(data: VaultData): Set<string> {
  return new Set(data.daily.map((n) => n.date).filter(Boolean));
}

/** Consecutive days with a note, ending today. If today isn't written yet we
 *  start from yesterday so the streak isn't prematurely broken. */
export function currentStreak(dates: Set<string>, todayIso: string): number {
  let cursor = dates.has(todayIso) ? todayIso : addDays(todayIso, -1);
  let n = 0;
  while (dates.has(cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

/** Oldest→newest list of the last n ISO dates ending today. */
export function lastNDays(todayIso: string, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(todayIso, -i));
  return out;
}

export type TaskStats = {
  total: number;
  done: number;
  open: number;
  overdue: number;
  high: number;
  inProgress: number;
  completion: number; // 0..1
};

export function taskStats(tasks: Task[], todayIso: string): TaskStats {
  let done = 0,
    overdue = 0,
    high = 0,
    inProgress = 0;
  for (const t of tasks) {
    if (t.status === "done") {
      done++;
      continue;
    }
    if (t.priority === "high") high++;
    if (t.status === "in_progress") inProgress++;
    if (t.due_date && t.due_date < todayIso) overdue++;
  }
  const total = tasks.length;
  const open = total - done;
  return { total, done, open, overdue, high, inProgress, completion: total ? done / total : 0 };
}
