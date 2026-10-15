import { describe, expect, it } from "vitest";
import { estimateTaskMinutes, planTaskTimeboxes } from "./timeboxing";
import type { Task } from "@/lib/types";

const task = (id: string, title: string, priority: Task["priority"] = "medium"): Task => ({
  id, title, priority, status: "todo", due_date: "", project: "research", tags: [],
  page_slug: "", created_at: "", updated_at: "", completed_at: "", estimate_minutes: 0,
  timebox_start: "", body: "",
});

describe("task timeboxing", () => {
  it("uses a focused estimate and respects a manual estimate", () => {
    expect(estimateTaskMinutes(task("write", "Draft research proposal", "high"))).toBe(120);
    expect(estimateTaskMinutes({ ...task("small", "Email advisor"), estimate_minutes: 30 })).toBe(30);
  });
  it("places higher-priority work around a busy meeting", () => {
    const boxes = planTaskTimeboxes(
      [task("later", "Read notes", "low"), task("first", "Implement parser", "high")],
      [{ id: "meeting", provider: "google", calendarId: "main", title: "Meeting", start: "2026-10-14T09:00:00", end: "2026-10-14T10:00:00", allDay: false }],
      new Date("2026-10-14T08:30:00"),
    );
    expect(boxes.map((box) => box.taskId)).toEqual(["first", "later"]);
    expect(new Date(boxes[0].start).getTime()).toBeGreaterThanOrEqual(new Date("2026-10-14T10:00:00").getTime());
  });
  it("uses agent estimates when planning focus blocks", () => {
    const boxes = planTaskTimeboxes(
      [task("agent", "Ambiguous research task")],
      [],
      new Date("2026-10-14T08:30:00"),
      { agent: 135 },
    );
    expect(boxes[0].minutes).toBe(135);
  });
});


describe("deadline-aware timeboxing", () => {
  const now = new Date(2026, 9, 14, 16);
  it("schedules by priority without placing lower-priority work past its deadline", () => {
    const boxes = planTaskTimeboxes([
      { ...task("later", "Later work", "high"), due_date: "2026-10-16", estimate_minutes: 120 },
      { ...task("urgent", "Due today", "low"), due_date: "2026-10-14", estimate_minutes: 120 },
    ], [], now);
    expect(boxes.map((box) => box.taskId)).toEqual(["later"]);
    expect(new Date(boxes[0].start)).toEqual(now);
    expect(boxes[0].dueDate).toBeUndefined();
  });
  it("does not spill a full estimate past the deadline or shorten it to fit", () => {
    const boxes = planTaskTimeboxes([
      { ...task("cannot-fit", "Long work"), due_date: "2026-10-14", estimate_minutes: 135 },
      { ...task("fits", "Short work"), due_date: "2026-10-14", estimate_minutes: 120 },
    ], [], now);
    expect(boxes.map((box) => box.taskId)).toEqual(["fits"]);
    expect(boxes[0].minutes).toBe(120);
  });
  it("honors a saved duration even when the agent suggests less", () => {
    const boxes = planTaskTimeboxes([
      { ...task("manual", "Work"), estimate_minutes: 61 },
    ], [], now, { manual: 30 });
    expect(boxes[0].minutes).toBe(75);
  });
  it("rounds an agent estimate up and rejects impossible and overdue deadlines", () => {
    const boxes = planTaskTimeboxes([
      { ...task("overdue", "Old work"), due_date: "2026-10-13" },
      { ...task("long", "Full day work"), due_date: "2026-10-14" },
      { ...task("agent", "Quick work"), due_date: "2026-10-14" },
    ], [], now, { long: 480, agent: 46 });
    expect(boxes).toEqual([{ taskId: "agent", start: now.toISOString(), minutes: 60 }]);
  });
  it("plans weekend deadlines on a preceding weekday", () => {
    const boxes = planTaskTimeboxes([
      { ...task("weekend", "Weekend deadline"), due_date: "2026-10-18", estimate_minutes: 60 },
    ], [], new Date(2026, 9, 16, 17));
    expect(new Date(boxes[0].start)).toEqual(new Date(2026, 9, 16, 17));
  });
  it("does not start in the past when now has seconds", () => {
    const boxes = planTaskTimeboxes([task("next", "Work")], [], new Date(2026, 9, 14, 9, 0, 1));
    expect(new Date(boxes[0].start)).toEqual(new Date(2026, 9, 14, 9, 15));
  });
  it("respects meetings in the second planning week", () => {
    const boxes = planTaskTimeboxes([
      { ...task("later", "Work"), due_date: "2026-10-22", estimate_minutes: 60 },
    ], [{ id: "busy", provider: "google", calendarId: "main", title: "Busy", allDay: false,
      start: new Date(2026, 9, 14, 9).toISOString(), end: new Date(2026, 9, 22, 17).toISOString() }], now);
    expect(new Date(boxes[0].start)).toEqual(new Date(2026, 9, 22, 17));
    expect(boxes[0].minutes).toBe(60);
  });
});


describe("automatic deadlines", () => {
  it("assigns missing due dates from free capacity after higher-priority work", () => {
    const boxes = planTaskTimeboxes([
      { ...task("low", "Flexible", "low"), estimate_minutes: 120 },
      { ...task("high", "Important", "high"), estimate_minutes: 120 },
    ], [], new Date(2026, 9, 14, 16));
    expect(boxes.map(({ taskId, dueDate }) => ({ taskId, dueDate }))).toEqual([
      { taskId: "high", dueDate: "2026-10-14" },
      { taskId: "low", dueDate: "2026-10-15" },
    ]);
  });
  it("moves an automatic deadline later when calendar commitments fill the day", () => {
    const boxes = planTaskTimeboxes([{ ...task("auto", "Work"), estimate_minutes: 60 }],
      [{ id: "busy", provider: "google", calendarId: "main", title: "Busy", allDay: false,
        start: new Date(2026, 9, 14, 9).toISOString(), end: new Date(2026, 9, 14, 18).toISOString() }],
      new Date(2026, 9, 14, 9));
    expect(boxes[0].dueDate).toBe("2026-10-15");
    expect(boxes[0].minutes).toBe(60);
  });
  it("uses due dates to order tasks with the same priority and preserves existing deadlines", () => {
    const boxes = planTaskTimeboxes([
      { ...task("later", "Later"), due_date: "2026-10-16", estimate_minutes: 60 },
      { ...task("sooner", "Sooner"), due_date: "2026-10-14", estimate_minutes: 60 },
    ], [], new Date(2026, 9, 14, 9));
    expect(boxes.map((box) => box.taskId)).toEqual(["sooner", "later"]);
    expect(boxes.every((box) => box.dueDate === undefined)).toBe(true);
  });
});

it("leaves already planned tasks in their existing slots", () => {
  expect(planTaskTimeboxes([{...task("planned", "Already scheduled"), timebox_start: "2026-10-15T09:00:00Z"}], [], new Date("2026-10-14T08:00:00Z"))).toEqual([]);
});
