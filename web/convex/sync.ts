"use node";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import matter from "gray-matter";
import { parseWikiPage, parseTask, firstParagraph, parseLogEntries } from "../lib/parse";
import { dailyDate } from "../lib/day";

// Pull the vault from GitHub into Convex, fetching only blobs whose SHA changed.
// Git stays the source of truth; this is a mirror. Configure GITHUB_TOKEN (read),
// GITHUB_REPO, GITHUB_BRANCH in the Convex deployment's env.
const REPO = process.env.GITHUB_REPO || "";
const BRANCH = process.env.GITHUB_BRANCH || "main";
const TOKEN = process.env.GITHUB_TOKEN || "";
const SUMMARIES = "wiki/daily-summaries.json";

function ghHeaders() {
  return {
    Authorization: `Bearer ${TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function ghJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: ghHeaders() });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<T>;
}

async function fetchBlob(sha: string): Promise<string> {
  const b = await ghJson<{ content: string; encoding: string }>(
    `https://api.github.com/repos/${REPO}/git/blobs/${sha}`,
  );
  return Buffer.from(b.content, (b.encoding as BufferEncoding) || "base64").toString("utf8");
}

const skip = (p: string) => /\/(README|index|_Template)\.md$/i.test(p);
const stemOf = (p: string) => p.split("/").pop()!.replace(/\.md$/i, "");

type TreeItem = { path: string; type: string; sha: string };

export const syncFromRepo = internalAction({
  args: {},
  handler: async (ctx) => {
    if (!TOKEN || !REPO) {
      console.warn("convex sync: GITHUB_TOKEN/GITHUB_REPO not set — skipping");
      return { skipped: true };
    }

    const tree = await ghJson<{ tree: TreeItem[] }>(
      `https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`,
    );
    const blobs = (tree.tree || []).filter((i) => i.type === "blob");
    const relevant = blobs.filter(
      (i) =>
        ((i.path.startsWith("wiki/pages/") || i.path.startsWith("wiki/tasks/") || i.path.startsWith("sources/daily/")) &&
          i.path.endsWith(".md") &&
          !skip(i.path)) ||
        i.path === "wiki/log.md" ||
        i.path === SUMMARIES,
    );

    const stored: Array<{ path: string; sha: string }> = await ctx.runQuery(
      internal.syncData.fileShas,
      {},
    );
    const storedMap = new Map(stored.map((s) => [s.path, s.sha]));
    const treePaths = new Set(relevant.map((i) => i.path));

    // Always have the summaries map (tiny) so daily previews are right; if it
    // changed, force every daily note to re-render its preview.
    const summItem = relevant.find((i) => i.path === SUMMARIES);
    let summaries: Record<string, string> = {};
    if (summItem) {
      try {
        summaries = JSON.parse(await fetchBlob(summItem.sha));
      } catch {
        summaries = {};
      }
    }
    const summariesChanged = summItem ? storedMap.get(SUMMARIES) !== summItem.sha : false;

    const changed: TreeItem[] = relevant.filter((i) => {
      if (i.path === SUMMARIES) return false; // handled via summaries map, not a table
      if (summariesChanged && i.path.startsWith("sources/daily/")) return true;
      return storedMap.get(i.path) !== i.sha;
    });

    const pages: unknown[] = [];
    const tasks: unknown[] = [];
    const daily: unknown[] = [];
    let replaceLog: unknown[] | undefined;
    const shaUpserts: { path: string; sha: string }[] = [];

    for (const item of changed) {
      const content = await fetchBlob(item.sha);
      shaUpserts.push({ path: item.path, sha: item.sha });
      if (item.path === "wiki/log.md") {
        // keep file order as an explicit sort index for the reactive query.
        replaceLog = parseLogEntries(content).map((e, i) => ({ ...e, order: i }));
      } else if (item.path.startsWith("wiki/pages/")) {
        pages.push(parseWikiPage(stemOf(item.path), content));
      } else if (item.path.startsWith("wiki/tasks/")) {
        const t = parseTask(stemOf(item.path), content);
        tasks.push({
          taskId: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          due_date: t.due_date,
          project: t.project,
          tags: t.tags,
          page_slug: t.page_slug,
          created_at: t.created_at,
          updated_at: t.updated_at,
          completed_at: t.completed_at,
          body: t.body,
        });
      } else if (item.path.startsWith("sources/daily/")) {
        const stem = stemOf(item.path);
        const body = matter(content).content.trim();
        const { iso, label } = dailyDate(stem);
        daily.push({
          file: stem,
          date: iso,
          label,
          preview: (summaries[stem] || "").trim() || firstParagraph(body, 90),
          body,
        });
      }
    }
    if (summItem) shaUpserts.push({ path: SUMMARIES, sha: summItem.sha });

    const deletedPaths = stored.filter((s) => !treePaths.has(s.path)).map((s) => s.path);
    const deletePages = deletedPaths.filter((p) => p.startsWith("wiki/pages/")).map(stemOf);
    const deleteTasks = deletedPaths.filter((p) => p.startsWith("wiki/tasks/")).map(stemOf);
    const deleteDaily = deletedPaths.filter((p) => p.startsWith("sources/daily/")).map(stemOf);

    await ctx.runMutation(internal.syncData.apply, {
      pages,
      tasks,
      daily,
      replaceLog,
      deletePages,
      deleteTasks,
      deleteDaily,
      shaUpserts,
      shaDeletes: deletedPaths,
      lastSync: new Date().toISOString(),
    });

    return { changed: changed.length, deleted: deletedPaths.length };
  },
});
