import type { Task } from "../types";
import { shiftDate, validTaskDate } from "../task-dates";
import type { CalEvent } from "./types";
import { estimateTaskMinutes } from "./timeboxing";

export const HOUR_PX = 64;

/** Snap a dragged time range to quarter-hours, including upward drags. */
export function selectionRange(anchor: number, current: number) {
  const snap = (minute: number) =>
    Math.max(0, Math.min(1425, Math.round(minute / 15) * 15));
  const start = Math.min(snap(anchor), snap(current));
  const end = Math.min(
    1440,
    Math.max(
      start + 30,
      Math.max(snap(anchor), Math.min(1440, Math.round(current / 15) * 15)),
    ),
  );
  return { start, end };
}
export const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
export function monthDays(date: Date): Date[] {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  return Array.from({ length: 42 }, (_, index) =>
    addDays(first, index - first.getDay()),
  );
}
export function weekDays(date: Date): Date[] {
  return Array.from({ length: 7 }, (_, index) =>
    addDays(date, index - date.getDay()),
  );
}
export function taskEvents(tasks: Task[]): CalEvent[] {
  return tasks
    .filter(
      (task) =>
        task.status !== "done" && task.due_date && validTaskDate(task.due_date),
    )
    .map((task) => ({
      id: `task:${task.id}`,
      taskId: task.id,
      provider: "tasks",
      calendarId: "tasks",
      title: task.title,
      ...(task.timebox_start
        ? {
            start: task.timebox_start,
            end: new Date(
              new Date(task.timebox_start).getTime() +
                estimateTaskMinutes(task) * 60_000,
            ).toISOString(),
            allDay: false,
          }
        : {
            start: task.due_date,
            end: shiftDate(task.due_date, 1),
            allDay: true,
          }),
      description: task.timebox_start
        ? `${task.project} · ${estimateTaskMinutes(task)} min focus block`
        : `${task.project} · ${task.priority} priority`,
    }));
}

/** Index every intersected day, respecting exclusive provider end dates. */
export function indexEvents(
  events: CalEvent[],
  days: Date[],
): Map<string, CalEvent[]> {
  const result = new Map<string, CalEvent[]>();
  for (const day of days) {
    const key = dateKey(day);
    const next = addDays(day, 1);
    const matching = events.filter((event) => {
      if (event.allDay)
        return event.start.slice(0, 10) <= key && event.end.slice(0, 10) > key;
      const start = new Date(event.start).getTime();
      const end = new Date(event.end).getTime();
      return start < next.getTime() && end > day.getTime();
    });
    result.set(
      key,
      matching.sort(
        (a, b) =>
          Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start),
      ),
    );
  }
  return result;
}

export type PlacedEvent = {
  event: CalEvent;
  top: number;
  height: number;
  lane: number;
  lanes: number;
};
/** Use wall-clock minutes (not elapsed UTC time) to keep DST days aligned. */
export function layoutDay(events: CalEvent[], day: Date): PlacedEvent[] {
  const key = dateKey(day);
  const items = events
    .filter((event) => !event.allDay)
    .map((event) => {
      const start = new Date(event.start),
        end = new Date(event.end);
      const startMinute =
        dateKey(start) < key ? 0 : start.getHours() * 60 + start.getMinutes();
      const endMinute =
        dateKey(end) > key ? 1440 : end.getHours() * 60 + end.getMinutes();
      return {
        event,
        start: startMinute,
        end: Math.min(1440, Math.max(endMinute, startMinute + 22)),
      };
    })
    .sort((a, b) => a.start - b.start || b.end - a.end);
  const result: PlacedEvent[] = [];
  let cluster: typeof items = [],
    clusterEnd = -1;
  function flush() {
    const ends: number[] = [];
    const lanes = cluster.map((item) => {
      let lane = ends.findIndex((end) => end <= item.start);
      if (lane < 0) lane = ends.length;
      ends[lane] = item.end;
      return lane;
    });
    cluster.forEach((item, index) =>
      result.push({
        event: item.event,
        top: (item.start / 60) * HOUR_PX,
        height: ((item.end - item.start) / 60) * HOUR_PX,
        lane: lanes[index],
        lanes: ends.length,
      }),
    );
    cluster = [];
    clusterEnd = -1;
  }
  for (const item of items) {
    if (cluster.length && item.start >= clusterEnd) flush();
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  flush();
  return result;
}
