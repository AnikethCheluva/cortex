// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { Task } from "./types";
import { useTaskWorkspace } from "./useTaskWorkspace";
const api = vi.hoisted(() => ({
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
}));
vi.mock("./clientapi", () => api);
const task = {
  id: "test",
  title: "Test",
  due_date: "",
  status: "todo",
  priority: "medium",
  project: "research",
  body: "",
  tags: [],
  page_slug: "",
  created_at: "",
  updated_at: "",
  completed_at: "",
} as Task;
const initialTasks = [task];
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
});
afterEach(() => vi.unstubAllGlobals());
describe("shared task workspace", () => {
  it("keeps a saved date when a stale vault snapshot arrives, then accepts live updates after acknowledgement", async () => {
    const saved = { ...task, due_date: "2026-10-09" };
    api.updateTask.mockResolvedValue(saved);
    const { result, rerender } = renderHook(
      ({ tasks }) => useTaskWorkspace(tasks),
      { initialProps: { tasks: [task] } },
    );
    await act(async () => {
      await result.current.save(task, { due_date: saved.due_date });
    });
    rerender({ tasks: [{ ...task }] });
    expect(result.current.tasks[0].due_date).toBe(saved.due_date);
    rerender({ tasks: [saved] });
    rerender({ tasks: [{ ...saved, due_date: "2026-11-01" }] });
    expect(result.current.tasks[0].due_date).toBe("2026-11-01");
  });
  it("rolls back optimistic changes after a failed write and releases the pending lock", async () => {
    api.updateTask.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useTaskWorkspace(initialTasks));
    await act(async () => {
      await expect(
        result.current.save(task, { due_date: "2026-10-09" }),
      ).rejects.toThrow("offline");
    });
    expect(result.current.tasks[0].due_date).toBe("");
    expect(result.current.pending.size).toBe(0);
  });
  it("does not let an earlier fetch erase a newly created task", async () => {
    let resolve!: (value: unknown) => void;
    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    api.createTask.mockResolvedValue({ ...task, id: "new" });
    const { result } = renderHook(() => useTaskWorkspace(initialTasks));
    await act(async () => {
      await result.current.add({ title: "New" });
    });
    await act(async () => {
      resolve({ ok: true, json: async () => ({ tasks: [] }) });
    });
    await waitFor(() =>
      expect(result.current.tasks.map((item) => item.id)).toEqual([
        "test",
        "new",
      ]),
    );
  });
});
