import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileRecord, surfaceFor } from "./records";
import type { ChangeRecord } from "./types";
const execute = promisify(execFile);
const scopes = [
  "sources",
  "wiki",
  ":(exclude)wiki/changelog",
  ":(exclude)wiki/srs/_*",
];
export const BASELINE = "wiki/changelog/.ingest-baseline.json";
export type Baseline = {
  version: 1;
  tree: string;
  head: string;
  startedAt: string;
  runId: string;
};
async function git(root: string, args: string[], env?: NodeJS.ProcessEnv) {
  return (
    await execute("git", args, {
      cwd: root,
      env: env ?? process.env,
      maxBuffer: 32 * 1024 * 1024,
    })
  ).stdout;
}
// A separate index captures tracked, dirty, and new files without staging the
// user's working copy. Git's content-addressed trees keep the snapshot exact.
export async function snapshotTree(root: string) {
  const temporary = await fs.mkdtemp(
    path.join(os.tmpdir(), "cortex-changelog-"),
  );
  const env = { ...process.env, GIT_INDEX_FILE: path.join(temporary, "index") };
  try {
    await git(root, ["read-tree", "HEAD"], env);
    await git(root, ["add", "-A", "--", ...scopes], env);
    return (await git(root, ["write-tree"], env)).trim();
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}
export async function beginIngest(
  root: string,
  runId: string,
  timestamp = new Date().toISOString(),
): Promise<Baseline> {
  const destination = path.join(root, BASELINE);
  try {
    await fs.access(destination);
    throw new Error(
      "An ingest snapshot already exists; finish it or explicitly abort it first.",
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const baseline: Baseline = {
    version: 1,
    tree: await snapshotTree(root),
    head: (await git(root, ["rev-parse", "HEAD"])).trim(),
    startedAt: timestamp,
    runId,
  };
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, JSON.stringify(baseline, null, 2) + "\n", {
    flag: "wx",
  });
  return baseline;
}
export async function diffIngest(
  root: string,
  baseline: Baseline,
  timestamp = new Date().toISOString(),
): Promise<ChangeRecord[]> {
  const tree = await snapshotTree(root);
  const names = (
    await git(root, [
      "diff",
      "--name-only",
      "-z",
      "--no-renames",
      baseline.tree,
      tree,
      "--",
      ...scopes,
    ])
  )
    .split("\0")
    .filter(Boolean);
  const records: ChangeRecord[] = [];
  for (const file of names) {
    if (!surfaceFor(file)) continue;
    const read = async (revision: string) => {
      try {
        return await git(root, ["show", `${revision}:${file}`]);
      } catch (error) {
        if ((error as { code?: number }).code === 128) return null;
        throw error;
      }
    };
    // Binary sources are reported as file mutations without decoding their bytes.
    const textual = /\.(md|json|jsonl|txt|csv)$/i.test(file);
    const readValue = async (revision: string) =>
      textual
        ? read(revision)
        : git(root, ["rev-parse", `${revision}:${file}`])
            .then((hash) => hash.trim())
            .catch((error) => {
              if (error.code === 128) return null;
              throw error;
            });
    const record = fileRecord(
      file,
      await readValue(baseline.tree),
      await readValue(tree),
      { timestamp, source: "ingest", runId: baseline.runId },
    );
    if (record && !textual) {
      const old = await readValue(baseline.tree),
        next = await readValue(tree);
      record.before = old === null ? undefined : { blob: old };
      record.after = next === null ? undefined : { blob: next };
      record.changedFields = [];
    }
    if (record) records.push(record);
  }
  return records;
}
