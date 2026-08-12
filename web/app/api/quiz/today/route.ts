import { NextResponse } from "next/server";
import matter from "gray-matter";
import { readVaultFile } from "@/lib/storage";
import { todayStem } from "@/lib/day";
import { splitDayNote } from "@/lib/daynote";
import { parseQuizIds } from "@/lib/srs/daysection";
import { readCards, readSubmissions } from "@/lib/srs/store";
import { selectDaily } from "@/lib/srs/select";
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

// GET → today's quiz questions (answer/rubric stripped). Normally the ingest
// writes the day's selection into today's daily note behind <!-- srs:quiz -->.
// If it hasn't run yet (or ever), we FALL BACK to selecting due + new cards live
// from the card bank — the same logic the ingest uses — so there is always a
// quiz to do as long as the bank has cards. The ingest's curated block wins
// whenever it exists.
export async function GET() {
  const stem = todayStem();
  const [bank, subs] = await Promise.all([readCards(), readSubmissions()]);
  const f = await readVaultFile(`sources/daily/${stem}.md`);
  const body = f ? matter(f.content).content : "";
  let ids = parseQuizIds(splitDayNote(body).quiz);
  let generated = false;
  if (!ids.length) {
    const cap = Number(process.env.QUIZ_DAILY_CAP || "20");
    ids = selectDaily(Object.values(bank), { max: cap }).map((c) => c.id);
    generated = ids.length > 0;
  }
  const cards = ids.map((id) => bank[id]).filter((c): c is Card => !!c).map(publicOf);
  // Already-answered-today cards (still in the ungraded queue) so the UI can skip them.
  const pending = new Set(subs.map((s) => s.card_id));
  const submittedIds = ids.filter((id) => pending.has(id));
  return NextResponse.json(
    { stem, cards, submittedIds, generated },
    { headers: { "Cache-Control": "no-store" } },
  );
}
