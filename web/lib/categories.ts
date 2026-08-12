// Left-border accent color for a task's project. Fixed colors for the common
// life-area projects, deterministic HSL hashing for anything else. Mirrors the
// reference dashboard's category coloring.
const FIXED: Record<string, string> = {
  "example-project": "#1a6b1a",
  research: "#1a5cb0",
  academics: "#803300",
  personal: "#5a5a5a",
  unsorted: "#9a9a9a",
};

export function projectColor(project?: string | null): string | undefined {
  if (!project) return undefined;
  const c = project.toLowerCase();
  if (FIXED[c]) return FIXED[c];
  let h = 0;
  for (let i = 0; i < c.length; i++) h = (Math.imul(h, 31) + c.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360}, 45%, 38%)`;
}

// ---- wiki folders ---------------------------------------------------------
// The wiki pages live flat in wiki/pages/, but each carries exactly one *type*
// tag (the first tag) that files it into a folder in the Wiki tab. The full
// tagging rulebook lives in wiki/wiki-schema.md.
export type WikiFolder = { key: string; label: string };

const TYPE_FOLDER: Record<string, WikiFolder> = {
  project: { key: "projects", label: "Projects" },
  proposal: { key: "projects", label: "Projects" },
  concept: { key: "concepts", label: "Concepts" },
  paper: { key: "papers", label: "Papers" },
  school: { key: "school", label: "School" },
  personal: { key: "personal", label: "Personal" },
  hub: { key: "topics", label: "Topics & Hubs" },
  archive: { key: "archive", label: "Archive" },
};

const OTHER: WikiFolder = { key: "other", label: "Other" };

// Display order of folders in the Wiki tab.
export const WIKI_FOLDER_ORDER = [
  "projects",
  "concepts",
  "papers",
  "school",
  "personal",
  "topics",
  "archive",
  "other",
];

/** Which folder a page belongs to, chosen by its first matching type tag. */
export function wikiFolder(tags: string[]): WikiFolder {
  for (const t of tags) {
    const f = TYPE_FOLDER[t.toLowerCase()];
    if (f) return f;
  }
  return OTHER;
}
