import { readAuthorized } from "@/lib/apiauth";
import { NextResponse } from "next/server";
import { readVaultFile, writeVaultFile, deleteVaultFile } from "@/lib/storage";
import { parseNoteDoc } from "@/lib/parse";
import { todayISO } from "@/lib/day";
import { apiAuthorized, unauthorized } from "@/lib/apiauth";
import { setFrontmatterField } from "@/lib/frontmatter";
import { readFolders } from "@/lib/notefolders";

export const dynamic = "force-dynamic";

// Slugs are lowercase-kebab (slugify); validate hard so they can't escape dir.
const VALID = /^[a-z0-9][a-z0-9-]{0,80}$/;
const rel = (slug: string) => `sources/notes/${slug}.md`;

// GET /api/notes/<slug> → load one document (live).
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!readAuthorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { slug } = await params;
  if (!VALID.test(slug)) return NextResponse.json({ error: "bad slug" }, { status: 400 });
  const file = await readVaultFile(rel(slug));
  if (!file) return NextResponse.json({ error: "not found" }, { status: 404 });
  const d = parseNoteDoc(slug, file.content);
  return NextResponse.json(
    { ...d, exists: true },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
  );
}

// PUT /api/notes/<slug> { title, body } → save the document as a wiki source.
export async function PUT(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!apiAuthorized(req)) return NextResponse.json(unauthorized(), { status: 401 });
  try {
    const { slug } = await params;
    if (!VALID.test(slug)) return NextResponse.json({ error: "bad slug" }, { status: 400 });
    const { title, body, folder } = await req.json();
    const text = typeof body === "string" ? body : "";
    const t = (typeof title === "string" && title.trim()) || slug;
    const existing = await readVaultFile(rel(slug));
    const prior = existing ? parseNoteDoc(slug, existing.content) : null;
    const created = prior?.created || todayISO();
    // This route rewrites the frontmatter wholesale, so anything it doesn't
    // name is destroyed on every save. Carry `folder` across explicitly —
    // otherwise editing a document would silently kick it out of its folder.
    const inFolder = typeof folder === "string" ? folder : (prior?.folder ?? "");
    // JSON.stringify quotes/escapes the title → always-valid YAML frontmatter.
    const content = `---\ntype: note\ntitle: ${JSON.stringify(
      t,
    )}\ncreated: ${created}\nupdated: ${todayISO()}${
      inFolder ? `\nfolder: ${inFolder}` : ""
    }\n---\n\n${text.replace(/\s+$/, "")}\n`;
    await writeVaultFile(rel(slug), content, `notes: ${slug}`);
    return NextResponse.json({ ok: true, slug, saved: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

// DELETE /api/notes/<slug> → remove the document.
export async function DELETE(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!apiAuthorized(req)) return NextResponse.json(unauthorized(), { status: 401 });
  try {
    const { slug } = await params;
    if (!VALID.test(slug)) return NextResponse.json({ error: "bad slug" }, { status: 400 });
    await deleteVaultFile(rel(slug), `notes: delete ${slug}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

// PATCH /api/notes/<slug> { folder } → move a document into a folder (or to the
// top level with ""). Surgical: only the frontmatter field changes, so dragging
// a card never rewrites the document body.
export async function PATCH(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!apiAuthorized(req)) return NextResponse.json(unauthorized(), { status: 401 });
  try {
    const { slug } = await params;
    if (!VALID.test(slug)) return NextResponse.json({ error: "bad slug" }, { status: 400 });
    const { folder } = (await req.json()) as { folder?: string };
    if (typeof folder !== "string")
      return NextResponse.json({ error: "folder required" }, { status: 400 });

    const existing = await readVaultFile(rel(slug));
    if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (folder && !(await readFolders()).some((f) => f.id === folder))
      return NextResponse.json({ error: "no such folder" }, { status: 400 });

    const content = setFrontmatterField(existing.content, "folder", folder);
    await writeVaultFile(rel(slug), content, `notes: move ${slug}`);
    return NextResponse.json({ ok: true, slug, folder });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
