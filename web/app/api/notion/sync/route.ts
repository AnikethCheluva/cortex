import { NextResponse } from "next/server";
import { apiAuthorized, unauthorized } from "@/lib/apiauth";
import { databaseToMarkdown, pageToMarkdown, type Converted } from "@/lib/notion";
import { writeVaultFile } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Target = { id: string; type?: "page" | "database" };

// POST { token, targets: [{id, type}] } → import each into sources/notion/.
// Re-running is idempotent: the same Notion page maps to the same slug, so the
// file is overwritten in place rather than duplicated.
export async function POST(req: Request) {
  if (!apiAuthorized(req)) return NextResponse.json(unauthorized(), { status: 401 });

  let token = "";
  let targets: Target[] = [];
  try {
    const b = (await req.json()) as { token?: string; targets?: Target[] };
    token = (b.token ?? "").trim();
    targets = Array.isArray(b.targets) ? b.targets : [];
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  if (!token) return NextResponse.json({ error: "Missing Notion token." }, { status: 400 });
  if (!targets.length) return NextResponse.json({ error: "Nothing selected." }, { status: 400 });

  const written: { slug: string; title: string; path: string }[] = [];
  const failed: { id: string; error: string }[] = [];

  for (const t of targets) {
    try {
      const docs: Converted[] =
        t.type === "database"
          ? await databaseToMarkdown(token, t.id)
          : [await pageToMarkdown(token, t.id)];

      for (const d of docs) {
        const path = `sources/notion/${d.slug}.md`;
        await writeVaultFile(path, d.markdown, `notion: sync ${d.title}`);
        written.push({ slug: d.slug, title: d.title, path });
      }
    } catch (e) {
      failed.push({ id: t.id, error: (e as Error).message });
    }
  }

  return NextResponse.json(
    { written, failed, count: written.length },
    { headers: { "Cache-Control": "no-store" } },
  );
}
