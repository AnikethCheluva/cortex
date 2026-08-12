// Read/write a single vault file from a SERVER route handler. Two backends,
// chosen at runtime:
//
//   • GitHub Contents API  — when GITHUB_TOKEN + GITHUB_REPO are set (Vercel).
//     Commits land on the repo; the Slack bot / nightly ingest pick them up via
//     their own git sync. The website never touches that machine directly.
//   • Local filesystem      — otherwise (local `next dev`), so the app is fully
//     testable on the same machine that holds the vault.
//
// Writes are restricted to the two human-authored areas: sources/daily/ and
// wiki/tasks/. wiki/pages/ stays read-only (it's LLM-generated).
import fs from "fs/promises";
import path from "path";

import { VAULT_ROOT } from "./vaultroot";

const TOKEN = process.env.GITHUB_TOKEN || "";
const REPO = process.env.GITHUB_REPO || ""; // "owner/name"
const BRANCH = process.env.GITHUB_BRANCH || "main";

export function usingGitHub(): boolean {
  return Boolean(TOKEN && REPO);
}

// Only these path prefixes may ever be written.
const WRITABLE = ["sources/daily/", "sources/notes/", "wiki/tasks/", "wiki/srs/"];

function assertWritable(relPath: string) {
  const clean = relPath.replace(/\\/g, "/");
  if (clean.includes("..") || clean.startsWith("/")) throw new Error("bad path");
  if (!WRITABLE.some((p) => clean.startsWith(p))) {
    throw new Error(`path not writable: ${clean}`);
  }
}

export type FileRead = { content: string; sha: string | null };

// ---- GitHub backend -------------------------------------------------------
async function ghGet(relPath: string): Promise<FileRead | null> {
  // The GitHub Contents API is served through a CDN that can hand back a stale
  // blob for up to ~a minute after a commit — which made a note saved on one
  // device not show up on another. A unique cache-bust param makes the CDN miss
  // and return the just-committed content (and a fresh sha, which also avoids
  // write 409s).
  const url = `https://api.github.com/repos/${REPO}/contents/${encodeURIComponent(
    relPath,
  ).replace(/%2F/g, "/")}?ref=${encodeURIComponent(BRANCH)}&_cb=${Date.now()}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Cache-Control": "no-cache",
    },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub read ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const content = Buffer.from(json.content ?? "", "base64").toString("utf8");
  return { content, sha: json.sha as string };
}

async function ghPut(relPath: string, content: string, message: string): Promise<void> {
  const url = `https://api.github.com/repos/${REPO}/contents/${encodeURIComponent(
    relPath,
  ).replace(/%2F/g, "/")}`;
  const b64 = Buffer.from(content, "utf8").toString("base64");

  // The Contents API needs the *current* blob sha to overwrite a file. Right
  // after a prior commit, a fresh GET can still return the stale sha (GitHub's
  // read-after-write lag), so the PUT 409s ("sha didn't match"). That surfaced
  // as the task checkbox flickering back. Re-fetch the latest sha and retry a
  // few times so a transient conflict resolves instead of failing the write.
  for (let attempt = 0; attempt < 4; attempt++) {
    const existing = await ghGet(relPath);
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        content: b64,
        branch: BRANCH,
        ...(existing?.sha ? { sha: existing.sha } : {}),
      }),
    });
    if (res.ok) return;
    // 409 (sha conflict) / 422 (stale sha) are retryable; anything else is fatal.
    if ((res.status === 409 || res.status === 422) && attempt < 3) {
      await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
      continue;
    }
    throw new Error(`GitHub write ${res.status}: ${await res.text()}`);
  }
}

// ---- local filesystem backend ---------------------------------------------
async function fsGet(relPath: string): Promise<FileRead | null> {
  try {
    const content = await fs.readFile(path.join(VAULT_ROOT, relPath), "utf8");
    return { content, sha: null };
  } catch {
    return null;
  }
}

async function fsPut(relPath: string, content: string): Promise<void> {
  const full = path.join(VAULT_ROOT, relPath);
  await fs.mkdir(path.dirname(full), { recursive: true });
  const tmp = `${full}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmp, content, "utf8");
  await fs.rename(tmp, full);
}

// ---- public API -----------------------------------------------------------
export async function readVaultFile(relPath: string): Promise<FileRead | null> {
  return usingGitHub() ? ghGet(relPath) : fsGet(relPath);
}

export async function writeVaultFile(
  relPath: string,
  content: string,
  message: string,
): Promise<void> {
  assertWritable(relPath);
  if (usingGitHub()) await ghPut(relPath, content, message);
  else await fsPut(relPath, content);
}

export async function deleteVaultFile(relPath: string, message: string): Promise<void> {
  assertWritable(relPath);
  if (usingGitHub()) {
    const existing = await ghGet(relPath);
    if (!existing?.sha) return; // already gone
    const url = `https://api.github.com/repos/${REPO}/contents/${encodeURIComponent(
      relPath,
    ).replace(/%2F/g, "/")}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message, sha: existing.sha, branch: BRANCH }),
    });
    if (!res.ok && res.status !== 404)
      throw new Error(`GitHub delete ${res.status}: ${await res.text()}`);
  } else {
    try {
      await fs.unlink(path.join(VAULT_ROOT, relPath));
    } catch {
      /* already gone */
    }
  }
}

/** List the `.md` file stems in a vault directory (e.g. "wiki/tasks",
 *  "sources/daily"). GitHub Contents API on Vercel, local fs in dev. */
export async function listVaultDir(relDir: string): Promise<string[]> {
  const keep = (name: string) => {
    const l = name.toLowerCase();
    return l.endsWith(".md") && l !== "readme.md" && l !== "index.md";
  };
  const stem = (name: string) => name.replace(/\.md$/i, "");
  if (usingGitHub()) {
    const url = `https://api.github.com/repos/${REPO}/contents/${relDir}?ref=${encodeURIComponent(
      BRANCH,
    )}&_cb=${Date.now()}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Cache-Control": "no-cache",
      },
      cache: "no-store",
    });
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`GitHub list ${res.status}: ${await res.text()}`);
    const items = (await res.json()) as { name: string; type: string }[];
    return items.filter((i) => i.type === "file" && keep(i.name)).map((i) => stem(i.name));
  }
  try {
    const entries = await fs.readdir(path.join(VAULT_ROOT, relDir));
    return entries.filter(keep).map(stem);
  } catch {
    return [];
  }
}
