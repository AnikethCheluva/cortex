import { NextResponse } from "next/server";
import { apiAuthorized, unauthorized } from "@/lib/apiauth";
import { readFolders, writeFolders } from "@/lib/notefolders";
import { listVaultDir, readVaultFile, writeVaultFile } from "@/lib/storage";
import { parseNoteDoc } from "@/lib/parse";
import { setFrontmatterField } from "@/lib/frontmatter";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const VALID = /^[a-z0-9][a-z0-9-]{0,60}$/;

// PATCH { name } → rename. One edit here; the documents inside are untouched
// because they reference the folder by id, not by name.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!apiAuthorized(req)) return NextResponse.json(unauthorized(), { status: 401 });
  const { id } = await params;
  if (!VALID.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  try {
    const { name } = (await req.json()) as { name?: string };
    const clean = (name ?? "").trim().slice(0, 60);
    if (!clean) return NextResponse.json({ error: "name required" }, { status: 400 });
    const folders = await readFolders();
    if (!folders.some((f) => f.id === id))
      return NextResponse.json({ error: "not found" }, { status: 404 });
    const next = folders.map((f) => (f.id === id ? { ...f, name: clean } : f));
    await writeFolders(next, `notes: rename folder ${clean}`);
    return NextResponse.json(next.find((f) => f.id === id));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

// DELETE → remove the folder. Documents inside are NOT deleted; they move back
// to the top level, so a folder can never take notes down with it.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!apiAuthorized(req)) return NextResponse.json(unauthorized(), { status: 401 });
  const { id } = await params;
  if (!VALID.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  try {
    const folders = await readFolders();
    if (!folders.some((f) => f.id === id))
      return NextResponse.json({ error: "not found" }, { status: 404 });

    let freed = 0;
    // listVaultDir yields .md stems (README/index already filtered out).
    for (const slug of await listVaultDir("sources/notes")) {
      const rel = `sources/notes/${slug}.md`;
      const existing = await readVaultFile(rel);
      if (!existing) continue;
      if (parseNoteDoc(slug, existing.content).folder !== id) continue;
      await writeVaultFile(
        rel,
        setFrontmatterField(existing.content, "folder", ""),
        `notes: move ${slug} out of deleted folder`,
      );
      freed++;
    }

    await writeFolders(
      folders.filter((f) => f.id !== id),
      `notes: delete folder ${id}`,
    );
    return NextResponse.json({ ok: true, freed });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
