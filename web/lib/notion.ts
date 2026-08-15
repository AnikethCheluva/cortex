// Notion → markdown importer, the same shape as the Obsidian importer: pull a
// page (or every row of a database) and write it into `sources/` as plain
// markdown with frontmatter, so the next ingest compiles it into the wiki like
// any other source. SERVER-ONLY — the integration token never reaches the client
// bundle; the browser holds it in localStorage and posts it per request.
//
// Uses the REST API directly (no SDK dependency).
const API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

export type NotionItem = {
  id: string;
  title: string;
  type: "page" | "database";
  url: string;
  edited: string;
};

type Json = Record<string, unknown>;
/* eslint-disable @typescript-eslint/no-explicit-any */

async function call(token: string, path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (body as Json).message || res.statusText;
    throw new Error(`Notion ${res.status}: ${msg}`);
  }
  return body;
}

// ---- text ----------------------------------------------------------------
function rich(arr: any[] | undefined): string {
  if (!Array.isArray(arr)) return "";
  return arr
    .map((t) => {
      if (t?.type === "equation") return `$${t.equation?.expression ?? ""}$`;
      let s: string = t?.plain_text ?? "";
      if (!s) return "";
      const a = t.annotations ?? {};
      if (a.code) s = `\`${s}\``;
      if (a.bold) s = `**${s}**`;
      if (a.italic) s = `*${s}*`;
      if (a.strikethrough) s = `~~${s}~~`;
      if (t.href) s = `[${s}](${t.href})`;
      return s;
    })
    .join("");
}

function titleOf(page: any): string {
  const props = page?.properties ?? {};
  for (const v of Object.values<any>(props)) {
    if (v?.type === "title") {
      const t = rich(v.title).trim();
      if (t) return t;
    }
  }
  if (Array.isArray(page?.title)) {
    const t = rich(page.title).trim();
    if (t) return t;
  }
  return "Untitled";
}

export function slugify(title: string, id: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  // suffix with a short id so two same-named Notion pages can't collide
  return `${base || "untitled"}-${id.replace(/-/g, "").slice(0, 8)}`;
}

// ---- blocks --------------------------------------------------------------
async function children(token: string, blockId: string): Promise<any[]> {
  const out: any[] = [];
  let cursor: string | undefined;
  do {
    const q = new URLSearchParams({ page_size: "100" });
    if (cursor) q.set("start_cursor", cursor);
    const res = await call(token, `/blocks/${blockId}/children?${q}`);
    out.push(...(res.results ?? []));
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return out;
}

/** Render a block list to markdown. Recurses into children (indented). */
async function render(token: string, blocks: any[], depth = 0): Promise<string> {
  const pad = "  ".repeat(depth);
  const lines: string[] = [];
  let numbering = 0;

  for (const b of blocks) {
    const t: string = b.type;
    const d = b[t] ?? {};
    const text = rich(d.rich_text);
    if (t !== "numbered_list_item") numbering = 0;

    switch (t) {
      case "paragraph":
        lines.push(text ? pad + text : "");
        break;
      case "heading_1":
        lines.push(`${pad}# ${text}`);
        break;
      case "heading_2":
        lines.push(`${pad}## ${text}`);
        break;
      case "heading_3":
        lines.push(`${pad}### ${text}`);
        break;
      case "bulleted_list_item":
        lines.push(`${pad}- ${text}`);
        break;
      case "numbered_list_item":
        lines.push(`${pad}${++numbering}. ${text}`);
        break;
      case "to_do":
        lines.push(`${pad}- [${d.checked ? "x" : " "}] ${text}`);
        break;
      case "toggle":
        lines.push(`${pad}- ${text}`);
        break;
      case "quote":
        lines.push(`${pad}> ${text}`);
        break;
      case "callout": {
        const icon = d.icon?.emoji ? `${d.icon.emoji} ` : "";
        lines.push(`${pad}> ${icon}${text}`);
        break;
      }
      case "code":
        lines.push(`${pad}\`\`\`${d.language === "plain text" ? "" : (d.language ?? "")}`);
        lines.push(rich(d.rich_text));
        lines.push(`${pad}\`\`\``);
        break;
      case "equation":
        lines.push(`${pad}$$${d.expression ?? ""}$$`);
        break;
      case "divider":
        lines.push(`${pad}---`);
        break;
      case "image":
      case "video":
      case "file":
      case "pdf": {
        const url = d.external?.url ?? d.file?.url ?? "";
        const cap = rich(d.caption) || t;
        // Notion's `file` URLs are short-lived signed links; external ones persist.
        lines.push(url ? `${pad}![${cap}](${url})` : "");
        break;
      }
      case "bookmark":
      case "embed":
      case "link_preview": {
        const url = d.url ?? "";
        lines.push(url ? `${pad}[${rich(d.caption) || url}](${url})` : "");
        break;
      }
      case "child_page":
        lines.push(`${pad}- ${d.title ?? "Untitled"} *(sub-page — import separately)*`);
        break;
      case "child_database":
        lines.push(`${pad}- ${d.title ?? "Database"} *(database — import separately)*`);
        break;
      case "table_row": {
        const cells = (d.cells ?? []).map((c: any[]) => rich(c).replace(/\|/g, "\\|"));
        lines.push(`${pad}| ${cells.join(" | ")} |`);
        break;
      }
      case "table":
        break; // header/rows come through as table_row children
      case "unsupported":
        break;
      default:
        if (text) lines.push(pad + text);
    }

    if (b.has_children && t !== "child_page" && t !== "child_database") {
      const kids = await children(token, b.id);
      const nested = await render(token, kids, t === "table" ? depth : depth + 1);
      if (t === "table") {
        // markdown tables need a separator after the header row
        const rows = nested.split("\n").filter(Boolean);
        if (rows.length) {
          const cols = (rows[0].match(/\|/g)?.length ?? 2) - 1;
          rows.splice(1, 0, `| ${Array(cols).fill("---").join(" | ")} |`);
        }
        lines.push(rows.join("\n"));
      } else if (nested.trim()) {
        lines.push(nested);
      }
    }
  }
  return lines.join("\n");
}

// ---- public --------------------------------------------------------------

/** Pages + databases the integration has been shared with. */
export async function listAccessible(token: string, query = ""): Promise<NotionItem[]> {
  const body: Json = { page_size: 100, sort: { direction: "descending", timestamp: "last_edited_time" } };
  if (query.trim()) body.query = query.trim();
  const res = await call(token, "/search", { method: "POST", body: JSON.stringify(body) });
  return (res.results ?? []).map((r: any) => ({
    id: r.id,
    title: titleOf(r),
    type: r.object === "database" ? "database" : "page",
    url: r.url ?? "",
    edited: (r.last_edited_time ?? "").slice(0, 10),
  }));
}

export type Converted = { slug: string; title: string; markdown: string; url: string; id: string };

/** One Notion page → a markdown source file body. */
export async function pageToMarkdown(token: string, id: string): Promise<Converted> {
  const page = await call(token, `/pages/${id}`);
  const title = titleOf(page);
  const blocks = await children(token, id);
  const body = await render(token, blocks);
  const synced = new Date(page.last_edited_time ?? Date.now()).toISOString().slice(0, 10);

  const markdown = [
    "---",
    `title: ${JSON.stringify(title)}`,
    "source: notion",
    `notion_id: ${page.id}`,
    `notion_url: ${page.url ?? ""}`,
    `updated: ${synced}`,
    "---",
    "",
    `# ${title}`,
    "",
    body.replace(/\n{3,}/g, "\n\n").trim(),
    "",
  ].join("\n");

  return { slug: slugify(title, page.id), title, markdown, url: page.url ?? "", id: page.id };
}

/** Every row of a database → one markdown file each. */
export async function databaseToMarkdown(token: string, id: string): Promise<Converted[]> {
  const out: Converted[] = [];
  let cursor: string | undefined;
  do {
    const res = await call(token, `/databases/${id}/query`, {
      method: "POST",
      body: JSON.stringify(cursor ? { page_size: 50, start_cursor: cursor } : { page_size: 50 }),
    });
    for (const row of res.results ?? []) out.push(await pageToMarkdown(token, row.id));
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return out;
}
