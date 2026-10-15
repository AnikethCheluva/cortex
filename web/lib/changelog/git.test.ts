import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { afterEach, expect, it } from "vitest";
import { beginIngest, diffIngest } from "./git";
import { appendLocalRecords } from "./local";
const execute = promisify(execFile);
let root: string;
afterEach(async () => {
  if (root) await fs.rm(root, { recursive: true, force: true });
});
it("snapshots dirty/untracked starting files, reports exact changes, and preserves the real index", async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "cortex-diff-test-"));
  const git = (args: string[]) => execute("git", args, { cwd: root });
  const write = async (file: string, text: string) => {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), text);
  };
  await git(["init"]);
  await git(["config", "user.name", "Test"]);
  await git(["config", "user.email", "test@example.com"]);
  await write(
    "wiki/tasks/task.md",
    "---\ntitle: Task\nstatus: todo\n---\nNotes",
  );
  await write("sources/notes/doc.md", "Original");
  await git(["add", "."]);
  await git(["commit", "-m", "initial"]);
  await write("sources/notes/doc.md", "Dirty starting text");
  await write("sources/daily/9-2-26.md", "Untracked starting text");
  const indexBefore = (await git(["diff", "--cached"])).stdout;
  const baseline = await beginIngest(root, "test-run", "2026-10-09T12:00:00Z");
  await expect(beginIngest(root, "another-run")).rejects.toThrow(
    "already exists",
  );
  await write(
    "wiki/tasks/task.md",
    "---\ntitle: Task\nstatus: done\n---\nNotes",
  );
  await write("sources/daily/9-2-26.md", "Edited old day");
  await fs.unlink(path.join(root, "sources/notes/doc.md"));
  await write("wiki/pages/new.md", "New page");
  const records = await diffIngest(root, baseline, "2026-10-09T13:00:00Z");
  expect(records.map((record) => record.action).sort()).toEqual(
    ["created", "deleted", "status_changed", "updated"].sort(),
  );
  expect(records.find((record) => record.surface === "daily")).toMatchObject({
    before: { bytes: 23 },
    noteDate: "2026-09-02",
  });
  expect((await git(["diff", "--cached"])).stdout).toBe(indexBefore);
  await appendLocalRecords(root, records);
  const repeated = await diffIngest(root, baseline, "2026-10-09T14:00:00Z");
  expect(repeated.map((record) => record.id)).toEqual(
    records.map((record) => record.id),
  );
  await appendLocalRecords(root, repeated);
  const day = JSON.parse(
    await fs.readFile(
      path.join(root, "wiki/changelog/2026-10-09.json"),
      "utf8",
    ),
  );
  expect(day.records).toHaveLength(4);
});
