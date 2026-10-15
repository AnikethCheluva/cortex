import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildTaskFile } from "./parse";
const storage = vi.hoisted(() => ({
  readVaultFile: vi.fn(),
  writeVaultFile: vi.fn(),
  listVaultDir: vi.fn(),
  deleteVaultFile: vi.fn(),
}));
vi.mock("./storage", () => storage);
vi.mock("./apiauth", () => ({ apiAuthorized: () => true }));
import { POST } from "@/app/api/tasks/route";
import { PATCH } from "@/app/api/tasks/[id]/route";
const params = { params: Promise.resolve({ id: "test-task" }) };
const req = (method: string, body: unknown) =>
  new Request("http://localhost/api/tasks/test-task", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  storage.writeVaultFile.mockResolvedValue(undefined);
  storage.readVaultFile.mockResolvedValue({
    content: buildTaskFile({
      title: "Test task",
      project: "research",
      due_date: "2026-10-08",
      today: "2026-10-01",
      body: "Keep these notes.",
    }),
  });
});
describe("task date write-back", () => {
  it("saves a changed deadline without losing the task notes", async () => {
    const response = await PATCH(
      req("PATCH", { due_date: "2026-11-09", priority: "high" }),
      params,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      due_date: "2026-11-09",
      priority: "high",
      body: "Keep these notes.",
    });
    expect(storage.writeVaultFile).toHaveBeenCalledOnce();
  });
  it("can clear an existing date", async () => {
    const response = await PATCH(req("PATCH", { due_date: "" }), params);
    expect((await response.json()).due_date).toBe("");
  });
  it("rejects invalid dates on both create and update before writing", async () => {
    storage.readVaultFile.mockResolvedValue(null);
    const created = await POST(
      req("POST", { title: "bad date", due_date: "2026-02-30" }),
    );
    expect(created.status).toBe(400);
    const updated = await PATCH(
      req("PATCH", { due_date: "next friday" }),
      params,
    );
    expect(updated.status).toBe(400);
    expect(storage.writeVaultFile).not.toHaveBeenCalled();
  });
  it("creates and returns a task with its chosen deadline", async () => {
    storage.readVaultFile.mockResolvedValue(null);
    const response = await POST(
      req("POST", {
        title: "Plan: next steps",
        due_date: "2026-12-31",
        priority: "high",
      }),
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      title: "Plan: next steps",
      due_date: "2026-12-31",
      priority: "high",
    });
  });
  it("clears completion metadata when reopening a task", async () => {
    storage.readVaultFile.mockResolvedValue({
      content:
        "---\ntitle: Test\nstatus: done\ncompleted_at: 2026-10-01\n---\n\nNotes",
    });
    const response = await PATCH(req("PATCH", { status: "todo" }), params);
    expect(await response.json()).toMatchObject({
      status: "todo",
      completed_at: "",
    });
  });
});
