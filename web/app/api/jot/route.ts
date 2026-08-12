import { NextResponse } from "next/server";
import matter from "gray-matter";
import { readVaultFile, writeVaultFile } from "@/lib/storage";
import { todayStem, todayISO } from "@/lib/day";
import { splitDayNote, combineDayNote } from "@/lib/daynote";
import { apiAuthorized, unauthorized } from "@/lib/apiauth";

export const dynamic = "force-dynamic";

// POST { text } → append a quick line to TODAY's daily note (the written part,
// leaving any voice-notes section intact). The universal quick-capture endpoint
// for Raycast / Shortcuts / widgets / any frontend.
export async function POST(req: Request) {
  if (!apiAuthorized(req)) return NextResponse.json(unauthorized(), { status: 401 });

  let text = "";
  try {
    const b = await req.json();
    text = String(b?.text ?? "").trim();
  } catch {
    return NextResponse.json({ error: "expected JSON { text }" }, { status: 400 });
  }
  if (!text) return NextResponse.json({ error: "no text" }, { status: 400 });

  const stem = todayStem();
  const rel = `sources/daily/${stem}.md`;
  const existing = await readVaultFile(rel);
  const bodyNow = existing ? matter(existing.content).content.trim() : "";

  const { written, voice, quiz } = splitDayNote(bodyNow);
  const newWritten = written ? `${written}\n\n${text}` : text;
  const newBody = combineDayNote(newWritten, voice, quiz);

  const fm = existing?.content.match(/^(---\n[\s\S]*?\n---\s*\n)/);
  const content =
    (fm ? fm[1] : `---\ntype: daily\nCreated: ${todayISO()}\n---\n`) + "\n" + newBody;

  await writeVaultFile(rel, content, `daily: jot ${stem}`);
  return NextResponse.json({ ok: true, stem }, { headers: { "Cache-Control": "no-store" } });
}
