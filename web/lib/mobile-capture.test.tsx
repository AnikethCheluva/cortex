// @vitest-environment jsdom
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DayEditor } from "@/components/DayEditor";
import { TodayTasks } from "@/components/TodayTasks";
import { todayISO } from "./day";
import { splitDayNote } from "./daynote";
import type { Task } from "./types";

const api = vi.hoisted(() => ({ getDay: vi.fn(), saveDay: vi.fn() }));
vi.mock("./clientapi", () => api);
vi.mock("next/dynamic", () => ({
  default: () => () => <div>Full note editor</div>,
}));
vi.mock("./useVoiceRecorder", () => ({
  useVoiceRecorder: () => ({ state: "idle", supported: true, start: vi.fn() }),
}));
const note = {
  stem: "10-8-26",
  iso: "2026-10-08",
  label: "October 8",
  body: "Server note",
  isToday: true,
  exists: true,
};
beforeEach(() => {
  vi.stubGlobal("React", React);
  localStorage.clear();
  vi.clearAllMocks();
  api.getDay.mockResolvedValue(note);
  api.saveDay.mockResolvedValue({ ok: true });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("phone capture drafts", () => {
  it("preserves a saved draft while the server note is still loading", async () => {
    localStorage.setItem("daily-draft:10-8-26", "Unsynced thought");
    let resolve!: (value: typeof note) => void;
    api.getDay.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    render(<DayEditor stem="10-8-26" compact />);
    expect(localStorage.getItem("daily-draft:10-8-26")).toBe(
      "Unsynced thought",
    );
    await act(async () => resolve(note));
    expect(screen.getByLabelText("Written notes")).toHaveProperty(
      "value",
      "Unsynced thought",
    );
  });
  it("retains quick edits when leaving immediately and reopening", async () => {
    const first = render(<DayEditor stem="10-8-26" compact />);
    fireEvent.change(await screen.findByLabelText("Written notes"), {
      target: { value: "A thought on the go" },
    });
    first.unmount();
    expect(
      splitDayNote(localStorage.getItem("daily-draft:10-8-26")!).written,
    ).toBe("A thought on the go");
    render(<DayEditor stem="10-8-26" compact />);
    expect(await screen.findByLabelText("Written notes")).toHaveProperty(
      "value",
      "A thought on the go",
    );
  });
  it("keeps newer typing when an earlier save finishes", async () => {
    let finish!: () => void;
    api.saveDay.mockImplementation(
      () =>
        new Promise<void>((done) => {
          finish = done;
        }),
    );
    render(<DayEditor stem="10-8-26" compact />);
    const input = await screen.findByLabelText("Written notes");
    fireEvent.change(input, { target: { value: "First revision" } });
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));
    fireEvent.change(input, { target: { value: "Newer revision" } });
    await act(async () => finish());
    expect(
      splitDayNote(localStorage.getItem("daily-draft:10-8-26")!).written,
    ).toBe("Newer revision");
  });
});

describe("compact task tracking", () => {
  const makeTask = (id: string, status: Task["status"] = "todo"): Task => ({
    id,
    title: id,
    status,
    due_date: todayISO(),
    priority: "medium",
    project: "personal",
    tags: [],
    body: "",
    page_slug: "",
    created_at: "",
    updated_at: "",
    completed_at: status === "done" ? todayISO() : "",
  });
  const setup = () => {
    const workspace = {
      tasks: [makeTask("Read paper"), makeTask("Send notes", "done")],
      pending: new Set<string>(),
      add: vi.fn().mockResolvedValue(makeTask("New")),
      save: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn(),
    };
    render(
      <TodayTasks
        workspace={workspace}
        openTask={vi.fn()}
        openTasks={vi.fn()}
      />,
    );
    return workspace;
  };
  it("adds a task dated today and clears the input after saving", async () => {
    const workspace = setup();
    fireEvent.change(screen.getByLabelText("New task for today"), {
      target: { value: "Sketch an idea" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add task for today" }));
    await waitFor(() =>
      expect(workspace.add).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Sketch an idea",
          due_date: todayISO(),
        }),
      ),
    );
    expect(screen.getByLabelText("New task for today")).toHaveProperty(
      "value",
      "",
    );
  });
  it("completes open tasks and can reopen completed tasks", async () => {
    const workspace = setup();
    fireEvent.click(
      screen.getByRole("button", { name: "Complete Read paper" }),
    );
    expect(workspace.save).toHaveBeenCalledWith(workspace.tasks[0], {
      status: "done",
    });
    fireEvent.click(screen.getByRole("button", { name: "1 completed today" }));
    fireEvent.click(screen.getByRole("button", { name: "Reopen Send notes" }));
    expect(workspace.save).toHaveBeenCalledWith(workspace.tasks[1], {
      status: "todo",
    });
  });
  it("keeps the new task text when saving fails", async () => {
    const workspace = setup();
    workspace.add.mockRejectedValue(new Error("Connection interrupted"));
    fireEvent.change(screen.getByLabelText("New task for today"), {
      target: { value: "Keep this task" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add task for today" }));
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Connection interrupted",
    );
    expect(screen.getByLabelText("New task for today")).toHaveProperty(
      "value",
      "Keep this task",
    );
  });
});
