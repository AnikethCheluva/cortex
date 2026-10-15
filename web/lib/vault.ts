// Build-time reader for the markdown vault that lives one directory above this
// app (../). The website is part of the wiki repo, so when Vercel builds it the
// vault files are present in the checkout; we read them here and ship a fully
// static site. Push wiki changes → Vercel redeploys → the site refreshes.
//
// READ-ONLY by design: a static Vercel deploy has no writable vault at runtime,
// and per the vault's CLAUDE.md wiki pages aren't hand-edited anyway. Editing
// would be a separate backend (Convex / a git write-back API), added later.
import fs from "fs/promises";
import path from "path";
import type {
  WikiPage,
  Task,
  DailyNote,
  LogEntry,
  PlannedEvent,
  NoteDocMeta,
  NoteFolder,
  VaultData,
} from "./types";
import {
  parseWikiPage,
  parseTask,
  parseNoteDoc,
  firstParagraph,
  parseLogEntries,
  safeMatter,
} from "./parse";
import { dailyDate } from "./day";
import { readChangelog } from "./changelog/records";
import type { DailyChangelog } from "./changelog/types";

// Vault root = parent of the web/ app dir. Overridable via env if relocated.
import { VAULT_ROOT } from "./vaultroot";
export { VAULT_ROOT } from "./vaultroot";

const WIKI_PAGES = path.join(VAULT_ROOT, "wiki", "pages");
const WIKI_TASKS = path.join(VAULT_ROOT, "wiki", "tasks");
const WIKI_LOG = path.join(VAULT_ROOT, "wiki", "log.md");
const DAILY = path.join(VAULT_ROOT, "sources", "daily");
// Google-Docs-style persistent documents (a wiki source area edited in the app).
const NOTES = path.join(VAULT_ROOT, "sources", "notes");
// Per-note one-line summaries, generated at ingest and kept in the wiki layer
// (not in the source notes). Keyed by daily-note filename stem.
const DAILY_SUMMARIES = path.join(VAULT_ROOT, "wiki", "daily-summaries.json");
// Agent-scoped project deliverables → the calendar's "Planned" overlay.
const PLANNED = path.join(VAULT_ROOT, "wiki", "calendar", "planned.json");

// ---- helpers --------------------------------------------------------------
async function listMd(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir);
    return entries.filter((f) => f.toLowerCase().endsWith(".md"));
  } catch {
    return [];
  }
}

// ---- wiki pages -----------------------------------------------------------
async function loadWikiPages(): Promise<WikiPage[]> {
  const files = await listMd(WIKI_PAGES);
  const pages: WikiPage[] = [];
  for (const f of files) {
    const lower = f.toLowerCase();
    if (lower === "index.md" || lower === "readme.md") continue;
    const slug = f.replace(/\.md$/i, "");
    const raw = await fs.readFile(path.join(WIKI_PAGES, f), "utf8");
    pages.push(parseWikiPage(slug, raw));
  }
  return pages.sort((a, b) => (b.updated || "").localeCompare(a.updated || ""));
}

// ---- task board -----------------------------------------------------------
async function loadTasks(): Promise<Task[]> {
  const files = await listMd(WIKI_TASKS);
  const tasks: Task[] = [];
  for (const f of files) {
    const lower = f.toLowerCase();
    if (lower === "readme.md" || lower === "index.md") continue;
    const id = f.replace(/\.md$/i, "");
    const raw = await fs.readFile(path.join(WIKI_TASKS, f), "utf8");
    tasks.push(parseTask(id, raw));
  }
  return tasks;
}

// ---- daily notes ----------------------------------------------------------
// Filenames are irregular: "2-18-25.md" (M-D-YY) or "2026-06-09.md" (ISO); the
// stem→date normalization lives in lib/day.ts (shared with the Convex sync).
async function loadDailySummaries(): Promise<Record<string, string>> {
  try {
    const raw = await fs.readFile(DAILY_SUMMARIES, "utf8");
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {}; // no summaries yet → fall back to first paragraph
  }
}

async function loadDaily(): Promise<DailyNote[]> {
  const files = await listMd(DAILY);
  const summaries = await loadDailySummaries();
  const notes: DailyNote[] = [];
  for (const f of files) {
    const stem = f.replace(/\.md$/i, "");
    const raw = await fs.readFile(path.join(DAILY, f), "utf8");
    const { content } = safeMatter(raw);
    const { iso, label } = dailyDate(stem);
    notes.push({
      file: stem,
      date: iso,
      label,
      // Prefer the ingest-generated summary; fall back to the first paragraph.
      preview: summaries[stem]?.trim() || firstParagraph(content, 90),
      body: content.trim(),
    });
  }
  return notes.sort((a, b) => {
    if (a.date && b.date) return b.date.localeCompare(a.date);
    if (a.date) return -1; // dated notes before undated
    if (b.date) return 1;
    return b.file.localeCompare(a.file);
  });
}

// ---- activity log ---------------------------------------------------------
async function loadLog(limit = 80): Promise<LogEntry[]> {
  let raw: string;
  try {
    raw = await fs.readFile(WIKI_LOG, "utf8");
  } catch {
    return [];
  }
  // log.md is appended oldest→newest; reverse so the feed reads newest-first.
  return parseLogEntries(raw).reverse().slice(0, limit);
}

// ---- persistent documents (sources/notes) ---------------------------------
async function loadNotes(): Promise<NoteDocMeta[]> {
  const files = await listMd(NOTES);
  const notes: NoteDocMeta[] = [];
  for (const f of files) {
    const lower = f.toLowerCase();
    if (lower === "readme.md" || lower === "index.md") continue;
    const slug = f.replace(/\.md$/i, "");
    const raw = await fs.readFile(path.join(NOTES, f), "utf8");
    const d = parseNoteDoc(slug, raw);
    notes.push({
      slug: d.slug,
      title: d.title,
      created: d.created,
      updated: d.updated,
      preview: firstParagraph(d.body, 100),
      folder: d.folder,
    });
  }
  // newest-edited first
  return notes.sort((a, b) => (b.updated || "").localeCompare(a.updated || ""));
}

// ---- Docs folders ---------------------------------------------------------
// Membership lives in each document's frontmatter; this manifest only exists so
// an empty folder still shows up.
async function loadNoteFolders(): Promise<NoteFolder[]> {
  try {
    const raw = await fs.readFile(
      path.join(VAULT_ROOT, "sources", "notes", "folders.json"),
      "utf8",
    );
    const obj = JSON.parse(raw);
    const arr = Array.isArray(obj) ? obj : obj?.folders;
    return Array.isArray(arr)
      ? arr.filter((f): f is NoteFolder => Boolean(f && f.id && f.name))
      : [];
  } catch {
    return []; // no folders yet
  }
}

// ---- planned deliverables (calendar overlay) ------------------------------
async function loadPlanned(): Promise<PlannedEvent[]> {
  try {
    const raw = await fs.readFile(PLANNED, "utf8");
    const obj = JSON.parse(raw);
    const arr = Array.isArray(obj) ? obj : obj?.events;
    return Array.isArray(arr)
      ? arr.filter((e): e is PlannedEvent =>
          Boolean(e && e.id && e.title && e.date),
        )
      : [];
  } catch {
    return []; // no planned file yet
  }
}

// ---- aggregate (called once at build time) --------------------------------
async function loadChangelog(): Promise<DailyChangelog[]> {
  const directory = path.join(VAULT_ROOT, "wiki/changelog");
  let names: string[];
  try {
    names = await fs.readdir(directory);
  } catch {
    return [];
  }
  const days: DailyChangelog[] = [];
  for (const name of names
    .filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))
    .sort()
    .reverse()
    .slice(0, 30)) {
    days.push(
      readChangelog(
        await fs.readFile(path.join(directory, name), "utf8"),
        name.slice(0, 10),
      ),
    );
  }
  return days;
}
export async function loadVault(): Promise<VaultData> {
  const [wiki, tasks, daily, log, planned, notes, noteFolders, changelog] =
    await Promise.all([
      loadWikiPages(),
      loadTasks(),
      loadDaily(),
      loadLog(),
      loadPlanned(),
      loadNotes(),
      loadNoteFolders(),
      loadChangelog(),
    ]);
  return {
    wiki,
    tasks,
    daily,
    log,
    planned,
    notes,
    noteFolders,
    changelog,
    builtAt: new Date().toISOString(),
  };
}
