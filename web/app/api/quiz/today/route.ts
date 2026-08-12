import { NextResponse } from "next/server";
import matter from "gray-matter";
import { readVaultFile } from "@/lib/storage";
import { todayStem } from "@/lib/day";
import { splitDayNote } from "@/lib/daynote";
import { parseQuizIds } from "@/lib/srs/daysection";
import { readCards, readSubmissions } from "@/lib/srs/store";
import type { Card, PublicCard } from "@/lib/srs/types";

export const dynamic = "force-dynamic";

const publicOf = (c: Card): PublicCard => ({
  id: c.id,
  stem: c.stem,
  type: c.type,
  topic: c.topic,
  source_file: c.source_file,
  difficulty_target: c.difficulty_target,
  cloze_text: c.cloze_text,
  choices: c.choices?.map((ch) => ({ text: ch.text })), // never leak `correct`
});

// GET → today's selected quiz questions (answer/rubric stripped). The selection
// is written into today's daily note behind <!-- srs:quiz --> at generation.
export async function GET() {
  const stem = todayStem();
  const f = await readVaultFile(`sources/daily/${stem}.md`);
  const body = f ? matter(f.content).content : "";
  const ids = parseQuizIds(splitDayNote(body).quiz);
  if (!ids.length) {
    return NextResponse.json(
      { stem, cards: [], submittedIds: [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  const [bank, subs] = await Promise.all([readCards(), readSubmissions()]);
  const cards = ids.map((id) => bank[id]).filter((c): c is Card => !!c).map(publicOf);
  // Already-answered-today cards (still in the ungraded queue) so the UI can skip them.
  const pending = new Set(subs.map((s) => s.card_id));
  const submittedIds = ids.filter((id) => pending.has(id));
  return NextResponse.json({ stem, cards, submittedIds }, { headers: { "Cache-Control": "no-store" } });
}
