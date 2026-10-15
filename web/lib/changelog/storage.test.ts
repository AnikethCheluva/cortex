import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { changeDate, fileRecord, readChangelog } from "./records";
let root: string;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "cortex-store-test-"));
  vi.resetModules();
  vi.stubEnv("GITHUB_TOKEN", "");
  vi.stubEnv("GITHUB_REPO", "");
  vi.stubEnv("VAULT_PATH", root);
});
afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  await fs.rm(root, { recursive: true, force: true });
});
it("records every web transition, doc edit/delete, and back-dated daily edit", async () => {
  const storage = await import("../storage");
  const task = (status: string) =>
    `---\ntitle: Task\nstatus: ${status}\n---\nNotes`;
  await storage.writeVaultFile("wiki/tasks/task.md", task("todo"), "create");
  await storage.writeVaultFile(
    "wiki/tasks/task.md",
    task("in_progress"),
    "start",
  );
  await storage.writeVaultFile("wiki/tasks/task.md", task("done"), "finish");
  await storage.writeVaultFile("wiki/tasks/task.md", task("done"), "no-op");
  await storage.writeVaultFile(
    "sources/notes/doc.md",
    "---\ntitle: Doc\n---\nFirst",
    "create doc",
  );
  await storage.writeVaultFile(
    "sources/notes/doc.md",
    "---\ntitle: Doc\n---\nSecond",
    "edit doc",
  );
  await storage.deleteVaultFile("sources/notes/doc.md", "delete doc");
  await storage.writeVaultFile(
    "sources/daily/9-2-26.md",
    "Old day edited",
    "daily",
  );
  const date = changeDate(new Date().toISOString());
  const day = JSON.parse(
    await fs.readFile(path.join(root, `wiki/changelog/${date}.json`), "utf8"),
  );
  expect(day.records).toHaveLength(7);
  expect(
    day.records
      .filter(
        (record: { action: string }) => record.action === "status_changed",
      )
      .map(
        (record: { before: { status: string }; after: { status: string } }) => [
          record.before.status,
          record.after.status,
        ],
      ),
  ).toEqual([
    ["todo", "in_progress"],
    ["in_progress", "done"],
  ]);
  expect(
    day.records.find(
      (record: { surface: string }) => record.surface === "daily",
    ),
  ).toMatchObject({ noteDate: "2026-09-02" });
  expect(await fs.readFile(path.join(root, "wiki/log.md"), "utf8")).toContain(
    "in_progress → done",
  );
});
it("retries a competing GitHub HEAD and retains both writers in the atomic tree", async () => {
  vi.stubEnv("GITHUB_TOKEN", "test-token");
  vi.stubEnv("GITHUB_REPO", "test/repo");
  const timestamp = new Date().toISOString(),
    date = changeDate(timestamp);
  const other = fileRecord("sources/notes/other.md", null, "Other note", {
    timestamp,
    source: "web",
    runId: "other",
  })!;
  const journal = { ...readChangelog(null, date), records: [other] };
  let headReads = 0,
    updates = 0;
  const trees: { path: string; content?: string; sha?: null }[][] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = new URL(String(url)),
        endpoint = u.pathname.replace("/repos/test/repo/", "");
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      let result: unknown;
      if (endpoint === "git/ref/heads/main")
        result = { object: { sha: ++headReads === 1 ? "head1" : "head2" } };
      else if (endpoint.startsWith("git/commits/") && !body)
        result = { tree: { sha: "tree-base" } };
      else if (endpoint.startsWith("contents/")) {
        const file = decodeURIComponent(endpoint.slice("contents/".length));
        if (
          file === `wiki/changelog/${date}.json` &&
          u.searchParams.get("ref") === "head2"
        )
          result = {
            content: Buffer.from(JSON.stringify(journal)).toString("base64"),
            sha: "journal-blob",
          };
        else return new Response("", { status: 404 });
      } else if (endpoint === "git/trees") {
        trees.push(body.tree);
        result = { sha: `tree${trees.length}` };
      } else if (endpoint === "git/commits" && body)
        result = { sha: `commit${trees.length}` };
      else if (endpoint === "git/refs/heads/main") {
        expect(body.force).toBe(false);
        if (++updates === 1) return new Response("", { status: 422 });
        result = { object: { sha: body.sha } };
      } else throw new Error(`Unexpected request: ${endpoint}`);
      return Response.json(result);
    }),
  );
  const storage = await import("../storage");
  await storage.writeVaultFile("sources/notes/new.md", "New note", "edit");
  expect(updates).toBe(2);
  expect(trees[1].map((file) => file.path)).toContain("sources/notes/new.md");
  const saved = JSON.parse(
    trees[1].find((file) => file.path === `wiki/changelog/${date}.json`)!
      .content!,
  );
  expect(saved.records).toHaveLength(2);
  expect(
    saved.records.some((record: { id: string }) => record.id === other.id),
  ).toBe(true);
});
