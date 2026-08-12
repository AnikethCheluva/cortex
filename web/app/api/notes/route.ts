import { NextResponse } from "next/server";
import { readVaultFile, writeVaultFile, listVaultDir } from "@/lib/storage";
import { parseNoteDoc, firstParagraph, slugify } from "@/lib/parse";
import { todayISO } from "@/lib/day";
import { apiAuthorized, unauthorized } from "@/lib/apiauth";
import type { NoteDocMeta } from "@/lib/types";

export const dynamic = "force-dynamic";

const rel = (slug: string) => `sources/notes/${slug}.md`;

// GET /api/notes → list all persistent documents (live from the vault).
export async function GET() {
  const slugs = await listVaultDir("sources/notes");
  const notes: NoteDocMeta[] = [];
  for (const slug of slugs) {
    const file = await readVaultFile(rel(slug));
    if (!file) continue;
    const d = parseNoteDoc(slug, file.content);
    notes.push({
      slug: d.slug,
      title: d.title,
      created: d.created,
      updated: d.updated,
      preview: firstParagraph(d.body, 100),
    });
  }
  notes.sort((a, b) => (b.updated || "").localeCompare(a.updated || ""));
  return NextResponse.json({ notes }, { headers: { "Cache-Control": "no-store" } });
}

// POST /api/notes { title? } → create a new blank document, return its slug.
export async function POST(req: Request) {
  if (!apiAuthorized(req)) return NextResponse.json(unauthorized(), { status: 401 });
  try {
    const { title } = await req.json().catch(() => ({}));
    const t = (typeof title === "string" && title.trim()) || "Untitled document";
    const base = slugify(t);
    // ensure the filename is unique among existing documents
    const existing = new Set(await listVaultDir("sources/notes"));
    let slug = base;
    for (let n = 2; existing.has(slug); n++) slug = `${base}-${n}`;
    const now = todayISO();
    // JSON.stringify quotes/escapes the title → always-valid YAML frontmatter.
    const content = `---\ntype: note\ntitle: ${JSON.stringify(t)}\ncreated: ${now}\nupdated: ${now}\n---\n\n`;
    await writeVaultFile(rel(slug), content, `notes: create ${slug}`);
    return NextResponse.json({ slug, title: t, created: now, updated: now });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
