import { describe, expect, it } from "vitest";
import { changeDate, fileRecord, mergeRecords, readChangelog } from "./records";
const context = {
  timestamp: "2026-10-09T02:00:00Z",
  source: "ingest" as const,
  runId: "run-1",
};
const task = (status: string) =>
  `---\ntitle: Test task\nstatus: ${status}\npriority: high\n---\n\nNotes`;
describe("structured change records", () => {
  it("captures the actual before/after transition", () => {
    expect(
      fileRecord("wiki/tasks/test.md", task("todo"), task("done"), context),
    ).toMatchObject({
      action: "status_changed",
      surface: "tasks",
      before: { status: "todo" },
      after: { status: "done" },
      changedFields: ["status"],
    });
  });
  it("separates the change day from a back-dated note", () => {
    const record = fileRecord(
      "sources/daily/9-2-26.md",
      "before",
      "after",
      context,
    )!;
    expect(changeDate(record.timestamp)).toBe("2026-10-08");
    expect(record.noteDate).toBe("2026-09-02");
  });
  it("retains deleted doc metadata and skips identical files/self changes", () => {
    expect(
      fileRecord(
        "sources/notes/my-doc.md",
        "---\ntitle: My doc\nfolder: work\n---\nText",
        null,
        context,
      ),
    ).toMatchObject({
      action: "deleted",
      before: { title: "My doc", folder: "work" },
    });
    expect(
      fileRecord("sources/notes/my-doc.md", "same", "same", context),
    ).toBeNull();
    expect(
      fileRecord("wiki/changelog/2026-10-08.json", null, "self", context),
    ).toBeNull();
  });
  it("deduplicates retries while retaining independent runs", () => {
    const first = fileRecord(
      "wiki/tasks/test.md",
      task("todo"),
      task("done"),
      context,
    )!;
    const second = fileRecord(
      "wiki/tasks/test.md",
      task("done"),
      task("todo"),
      { ...context, runId: "run-2" },
    )!;
    const day = mergeRecords(readChangelog(null, "2026-10-08"), [
      first,
      first,
      second,
    ]);
    expect(day.records).toHaveLength(2);
    expect(() =>
      mergeRecords(readChangelog(null, "2026-10-09"), [first]),
    ).toThrow("another day");
  });
});
