import { NextResponse } from "next/server";
import matter from "gray-matter";
import { readVaultFile, writeVaultFile } from "@/lib/storage";
import { mergeDayNote } from "@/lib/daynote";
import { todayStem, todayISO, prettyISO } from "@/lib/day";
import { apiAuthorized, unauthorized } from "@/lib/apiauth";

export const dynamic = "force-dynamic";

// A brand-new day opens blank — no placeholder scaffolding.
const TEMPLATE_BODY = "";

// Daily note filenames are "M-D-YY" (e.g. 6-26-26) or ISO "YYYY-M-D". Validate
// hard so the stem can't escape sources/daily/.
function stemToISO(stem: string): string | null {
  const iso = stem.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const mdy = stem.match(/^(\d{1,2})-(\d{1,2})-(\d{2})$/);
  if (mdy) {
    const [, m, d, yy] = mdy;
    return `20${yy}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

function relFor(stem: string) {
  return `sources/daily/${stem}.md`;
}

// GET /api/daily/<stem> → load any day's note (live from the vault).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ stem: string }> },
) {
  const { stem } = await params;
  const iso = stemToISO(stem);
  if (!iso) return NextResponse.json({ error: "bad date" }, { status: 400 });

  const file = await readVaultFile(relFor(stem));
  // Only today gets the blank template when it doesn't exist yet; past days
  // that don't exist come back empty (you can still write one).
  const fallback = stem === todayStem() ? TEMPLATE_BODY : "";
  const body = file ? matter(file.content).content.trim() : fallback;
  return NextResponse.json(
    {
      stem,
      iso,
      label: prettyISO(iso),
      body,
      exists: Boolean(file),
      isToday: stem === todayStem(),
    },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
  );
}

// PUT /api/daily/<stem> { body } → save any day's note as a vault source.
// Preserves existing frontmatter; otherwise stamps `type: daily` + the day's
// own Created date so it meshes with the Obsidian Daily Log.
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ stem: string }> },
) {
  if (!apiAuthorized(req)) return NextResponse.json(unauthorized(), { status: 401 });
  try {
    const { stem } = await params;
    const iso = stemToISO(stem);
    if (!iso) return NextResponse.json({ error: "bad date" }, { status: 400 });

    const { body } = await req.json();
    const text = typeof body === "string" ? body : "";
    const rel = relFor(stem);

    const existing = await readVaultFile(rel);
    // Never let a stale client drop the server-managed recall-quiz block.
    const priorBody = existing ? matter(existing.content).content : "";
    const merged = mergeDayNote(text, priorBody);
    const created = stem === todayStem() ? todayISO() : iso;
    let content: string;
    if (existing) {
      const fm = existing.content.match(/^(---\n[\s\S]*?\n---\s*\n)/);
      content =
        (fm ? fm[1] : `---\ntype: daily\nCreated: ${created}\n---\n`) +
        "\n" +
        merged.replace(/\s+$/, "") +
        "\n";
    } else {
      content = `---\ntype: daily\nCreated: ${created}\n---\n\n${merged.replace(
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
