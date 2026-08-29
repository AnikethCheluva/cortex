import { NextResponse } from "next/server";
import matter from "gray-matter";
import { readVaultFile, writeVaultFile } from "@/lib/storage";
import { mergeDayNote } from "@/lib/daynote";
import { todayISO, todayStem, prettyISO } from "@/lib/day";
import { apiAuthorized, unauthorized } from "@/lib/apiauth";

export const dynamic = "force-dynamic";

// A brand-new day opens blank — no placeholder scaffolding.
const TEMPLATE_BODY = "";

function relFor(stem: string) {
  return `sources/daily/${stem}.md`;
}

// GET today's note (live from the vault). If it doesn't exist yet, hand back the
// blank template so the editor opens to a fresh day.
export async function GET() {
  const stem = todayStem();
  const iso = todayISO();
  const file = await readVaultFile(relFor(stem));
  const body = file ? matter(file.content).content.trim() : TEMPLATE_BODY;
  return NextResponse.json(
    {
      stem,
      iso,
      label: prettyISO(iso),
      body,
      exists: Boolean(file),
    },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
  );
}

// PUT today's note → save it as a vault source (sources/daily/<M-D-YY>.md).
// Preserves frontmatter if the file already exists; otherwise stamps a fresh
// `type: daily` + `Created:` header so it meshes with the Obsidian Daily Log.
export async function PUT(req: Request) {
  if (!apiAuthorized(req)) return NextResponse.json(unauthorized(), { status: 401 });
  try {
    const { body } = await req.json();
    const text = typeof body === "string" ? body : "";
    const stem = todayStem();
    const rel = relFor(stem);

    const existing = await readVaultFile(rel);
    // Never let a stale client drop the server-managed recall-quiz block.
    const priorBody = existing ? matter(existing.content).content : "";
    const merged = mergeDayNote(text, priorBody);
    let content: string;
    if (existing) {
      const parsed = matter(existing.content);
      const fm = existing.content.match(/^(---\n[\s\S]*?\n---\s*\n)/);
      content = (fm ? fm[1] : `---\ntype: daily\nCreated: ${todayISO()}\n---\n`) +
        "\n" + merged.replace(/\s+$/, "") + "\n";
      void parsed;
    } else {
      content = `---\ntype: daily\nCreated: ${todayISO()}\n---\n\n${merged.replace(
        /\s+$/,
        "",
      )}\n`;
    }
    await writeVaultFile(rel, content, `daily: ${stem}`);
    return NextResponse.json({ ok: true, stem, saved: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
