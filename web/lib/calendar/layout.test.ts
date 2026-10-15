import { describe, expect, it } from "vitest";
import {
  indexEvents,
  layoutDay,
  taskEvents,
  dateKey,
  weekDays,
  monthDays,
  HOUR_PX,
} from "./layout";
import { plannedToEvents } from "./planned";
import type { CalEvent } from "./types";
import type { Task } from "../types";
const event = (start: string, end: string, allDay = false): CalEvent => ({
  id: start,
  title: "Event",
  calendarId: "test",
  provider: "google",
  start,
  end,
  allDay,
});
const days = [
  new Date(2026, 9, 8),
  new Date(2026, 9, 9),
  new Date(2026, 9, 10),
];
describe("calendar day indexing", () => {
  it("includes every all-day date but excludes the provider end date", () => {
    const indexed = indexEvents(
      [event("2026-10-08", "2026-10-10", true)],
      days,
    );
    expect(indexed.get("2026-10-08")).toHaveLength(1);
    expect(indexed.get("2026-10-09")).toHaveLength(1);
    expect(indexed.get("2026-10-10")).toHaveLength(0);
  });
  it("splits overnight events over both days without leaking past midnight", () => {
    const indexed = indexEvents(
      [
        event(
          new Date(2026, 9, 8, 23).toISOString(),
          new Date(2026, 9, 10).toISOString(),
        ),
      ],
      days,
    );
    expect([...indexed.values()].map((events) => events.length)).toEqual([
      1, 1, 0,
    ]);
  });
  it("converts inclusive planned deliverables into exclusive calendar dates", () => {
    const events = plannedToEvents(
      [
        {
          id: "p",
          title: "Deliverable",
          date: "2026-10-08",
          end: "2026-10-09",
        },
      ],
      "2026-10-08",
      "2026-10-11",
    );
    expect(events[0].end).toBe("2026-10-10");
    expect(
      [...indexEvents(events, days).values()].map((events) => events.length),
    ).toEqual([1, 1, 0]);
  });
  it("shows a single-day plan and hides completed or undated tasks", () => {
    const plan = plannedToEvents(
      [{ id: "p", title: "Plan", date: "2026-10-08" }],
      "2026-10-08",
      "2026-10-11",
    );
    expect(indexEvents(plan, days).get("2026-10-08")).toHaveLength(1);
    const task = {
      id: "a",
      title: "Task",
      status: "todo",
      due_date: "2026-10-08",
      project: "test",
      priority: "high",
    } as Task;
    const events = taskEvents([
      task,
      { ...task, id: "b", status: "done" },
      { ...task, id: "c", due_date: "" },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      taskId: "a",
      start: "2026-10-08",
      end: "2026-10-09",
    });
  });
});
describe("calendar layout", () => {
  const local = (hour: number, minute = 0) =>
    new Date(2026, 9, 8, hour, minute).toISOString();
  it("places overlaps in lanes and resets width for a later cluster", () => {
    const placed = layoutDay(
      [
        event(local(9), local(11)),
        event(local(10), local(12)),
        event(local(14), local(15)),
      ],
      days[0],
    );
    expect(placed.map(({ lane, lanes }) => [lane, lanes])).toEqual([
      [0, 2],
      [1, 2],
      [0, 1],
    ]);
    expect(placed[0].top).toBe(9 * HOUR_PX);
  });
  it("clips overnight blocks at the visible day's boundaries", () => {
    const placed = layoutDay(
      [event(new Date(2026, 9, 7, 22).toISOString(), local(2))],
      days[0],
    );
    expect(placed[0]).toMatchObject({ top: 0, height: 2 * HOUR_PX });
  });
  it("keeps a minimum visible hit area for short events and avoids overlapping lanes", () => {
    const placed = layoutDay(
      [event(local(9), local(9, 5)), event(local(9, 10), local(9, 15))],
      days[0],
    );
    expect(placed[0].height).toBeGreaterThan(20);
    expect(placed[0].lanes).toBe(2);
  });
  it("builds complete weeks across year boundaries", () => {
    expect(weekDays(new Date(2027, 0, 1)).map(dateKey)).toEqual([
      "2026-12-27",
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
    ]);
    expect(monthDays(new Date(2026, 1, 1))).toHaveLength(42);
  });
});

it("renders a scheduled task without requiring a due date", () => {
  const task = {id: "manual", title: "Plan report", status: "todo", priority: "medium", due_date: "", estimate_minutes: 90, timebox_start: "2026-10-15T09:00:00Z", project: "", tags: [], page_slug: "", created_at: "", updated_at: "", completed_at: "", body: ""} as Task;
  expect(taskEvents([task])).toEqual([expect.objectContaining({taskId: "manual", allDay: false, start: task.timebox_start, end: "2026-10-15T10:30:00.000Z"})]);
});
