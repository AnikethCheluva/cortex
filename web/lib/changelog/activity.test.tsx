// @vitest-environment jsdom
import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LogTab } from "@/components/LogTab";
import { todayISO } from "../day";
import { fileRecord, readChangelog } from "./records";
vi.mock("../markdown", () => ({
  Markdown: ({ body }: { body: string }) => <div>{body}</div>,
}));
const date = todayISO();
const context = {
  timestamp: `${date}T15:00:00Z`,
  source: "web" as const,
  runId: "web-test",
};
const task = fileRecord(
  "wiki/tasks/task.md",
  "---\ntitle: Finish task\nstatus: todo\n---",
  "---\ntitle: Finish task\nstatus: done\n---",
  context,
)!;
const doc = fileRecord(
  "sources/notes/doc.md",
  null,
  "---\ntitle: Research notes\n---\nContent",
  context,
)!;
const day = { ...readChangelog(null, date), records: [task, doc] };
beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      Response.json(
        new URL(url, "http://localhost").searchParams.get("date") === date
          ? day
          : readChangelog(null, "2026-09-02"),
      ),
    ),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("renders transitions, filters surfaces, and opens the task", async () => {
  const openTask = vi.fn();
  render(<LogTab entries={[]} changes={[day]} openTask={openTask} />);
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toBe("2 changes"),
  );
  expect(screen.getByText("To do → Done")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Open task" }));
  expect(openTask).toHaveBeenCalledWith("task");
  fireEvent.change(screen.getByLabelText("Changelog surface"), {
    target: { value: "docs" },
  });
  expect(screen.queryByRole("heading", { name: "Finish task" })).toBeNull();
  expect(screen.getByRole("heading", { name: "Research notes" })).toBeTruthy();
});
it("can browse another date without retaining the old day's entries", async () => {
  render(<LogTab entries={[]} changes={[day]} />);
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toBe("2 changes"),
  );
  fireEvent.change(screen.getByLabelText("Changelog date"), {
    target: { value: "2026-09-02" },
  });
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toBe("0 changes"),
  );
  expect(screen.queryByRole("heading", { name: "Finish task" })).toBeNull();
});
it("keeps the historical prose log accessible", () => {
  render(
    <LogTab
      entries={[
        {
          date: "2026-09-02",
          action: "ingest",
          heading: "Older ingest",
          body: "Historical changes",
        },
      ]}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Legacy log" }));
  expect(screen.getByText("Historical changes")).toBeTruthy();
});
