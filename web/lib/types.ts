// Shared client-side shapes (mirrors the server types in lib/vault.ts, but
// importable from "use client" components without pulling in fs/server-only).
export type WikiPageMeta = {
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  updated: string;
};
export type WikiPage = WikiPageMeta & { sources: string[]; body: string };

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "high" | "medium" | "low";
export type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string;
  project: string;
  tags: string[];
  page_slug: string;
  created_at: string;
  updated_at: string;
  completed_at: string;
  body: string;
};

export type DailyMeta = {
  file: string;
  date: string;
  label: string;
  preview: string;
};
export type DailyNote = DailyMeta & { body: string };

export type LogEntry = { date: string; action: string; heading: string; body: string };

// Persistent documents (Google-Docs-style) authored in the web app and stored in
// sources/notes/ — they're wiki SOURCES the ingest later compiles into pages.
export type NoteDocMeta = {
  slug: string;
  title: string;
  created: string;
  updated: string;
  preview: string;
};
export type NoteDoc = NoteDocMeta & { body: string; exists?: boolean };

// Agent-scoped deliverable/milestone dates, written by the ingest into
// wiki/calendar/planned.json and overlaid on the calendar as a "Planned" source.
export type PlannedEvent = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD (start / the deliverable day)
  end?: string; // YYYY-MM-DD (optional multi-day end)
  allDay?: boolean; // default true
  project?: string;
  page_slug?: string; // wiki project page this belongs to
  kind?: string; // deliverable | milestone | review | checkpoint
  note?: string;
  source?: string; // sources/... file that motivated it
  createdAt?: string;
};

// The whole vault, read once at build time and handed to the static SPA.
export type VaultData = {
  wiki: WikiPage[];
  tasks: Task[];
  daily: DailyNote[];
  log: LogEntry[];
  planned: PlannedEvent[];
  notes: NoteDocMeta[];
  builtAt: string;
};
