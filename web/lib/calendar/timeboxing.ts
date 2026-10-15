import type { Task } from "@/lib/types";
import type { CalEvent } from "./types";
import { addDays, dateKey } from "./layout";

export type TaskTimebox = {
  taskId: string;
  start: string;
  minutes: number;
  dueDate?: string;
};

export const TIMEBOX_HORIZON_DAYS = 14;

const WORK_START = 9 * 60;
const WORK_END = 18 * 60;
const LUNCH_START = 12 * 60;
const LUNCH_END = 13 * 60;

/** A transparent fallback until a connected agent supplies a better estimate. */
export function estimateTaskMinutes(task: Task): number {
  if (Number.isFinite(task.estimate_minutes) && task.estimate_minutes > 0)
    return Math.ceil(task.estimate_minutes / 15) * 15;
  const text = `${task.title} ${task.body}`.toLowerCase();
  let minutes = task.priority === "high" ? 90 : task.priority === "medium" ? 60 : 45;
  if (/research|write|draft|implement|build|study|review|prepare/.test(text)) minutes += 30;
  if (task.body.trim().length > 280) minutes += 30;
  return Math.min(180, Math.max(30, Math.ceil(minutes / 15) * 15));
}

function localDate(date: Date, minute: number) {
  const value = new Date(date);
  value.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
  return value;
}

function overlaps(start: number, end: number, busy: Array<[number, number]>) {
  return busy.some(([from, to]) => start < to && end > from);
}

function busyMinutes(events: CalEvent[], day: Date): Array<[number, number]> {
  const key = dateKey(day);
  return events
    .filter((event) => !event.allDay)
    .flatMap((event) => {
      const start = new Date(event.start);
      const end = new Date(event.end);
      if (dateKey(end) < key || dateKey(start) > key) return [];
      const from = dateKey(start) < key ? 0 : start.getHours() * 60 + start.getMinutes() + start.getSeconds() / 60;
      const to = dateKey(end) > key ? 1440 : end.getHours() * 60 + end.getMinutes() + end.getSeconds() / 60;
      return [[from, to] as [number, number]];
    });
}

/**
 * Place open tasks into weekday focus blocks around existing calendar events.
 * It works locally and never writes to an external calendar; the returned
 * timeboxes are persisted on tasks and rendered directly in Cortex's schedule.
 */
export function planTaskTimeboxes(
  tasks: Task[],
  events: CalEvent[],
  now = new Date(),
  agentEstimates: Record<string, number> = {},
): TaskTimebox[] {
  // A saved estimate is the user's time budget. Only ask the agent to fill
  // missing estimates, and round up so we never reserve less work than needed.
  function duration(task: Task) {
    if (Number.isFinite(task.estimate_minutes) && task.estimate_minutes > 0)
      return estimateTaskMinutes(task);
    const suggested = agentEstimates[task.id];
    return Number.isFinite(suggested) && suggested > 0
      ? Math.ceil(suggested / 15) * 15
      : estimateTaskMinutes(task);
  }
  const candidates = tasks
    .filter((task) => task.status !== "done" && !task.timebox_start)
    .sort((a, b) => {
      const priority = { high: 0, medium: 1, low: 2 };
      return (
        priority[a.priority] - priority[b.priority] ||
        (a.due_date || "9999-12-31").localeCompare(b.due_date || "9999-12-31") ||
        duration(b) - duration(a)
      );
    });
  const result: TaskTimebox[] = [];
  const occupied = new Map<string, Array<[number, number]>>();

  for (const task of candidates) {
    const minutes = duration(task);
    for (let offset = 0; offset < TIMEBOX_HORIZON_DAYS; offset++) {
      const day = addDays(now, offset);
      const key = dateKey(day);
      // Date-only deadlines include the due date in the user's local timezone.
      // Overdue tasks cannot be promised an on-time slot; report them instead.
      if (task.due_date && key > task.due_date) break;
      if (day.getDay() === 0 || day.getDay() === 6) continue;
      const dayBusy = occupied.get(key) ?? busyMinutes(events, day);
      occupied.set(key, dayBusy);
      const earliest = offset === 0
        ? Math.max(WORK_START, now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60 + now.getMilliseconds() / 60_000)
        : WORK_START;
      let placed = false;
      for (let cursor = Math.ceil(earliest / 15) * 15; cursor + minutes <= WORK_END; cursor += 15) {
        if (cursor < LUNCH_END && cursor + minutes > LUNCH_START) continue;
        if (overlaps(cursor, cursor + minutes, dayBusy)) continue;
        const start = localDate(day, cursor);
        result.push({
          taskId: task.id, start: start.toISOString(), minutes,
          ...(!task.due_date ? { dueDate: key } : {}),
        });
        dayBusy.push([cursor, cursor + minutes]);
        placed = true;
        break;
      }
      if (placed) break;
    }
  }
  return result;
}
