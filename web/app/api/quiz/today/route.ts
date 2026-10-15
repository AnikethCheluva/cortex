import { readAuthorized } from "@/lib/apiauth";
import { NextResponse } from "next/server";
import matter from "gray-matter";
import { readVaultFile } from "@/lib/storage";
import { todayStem, todayISO } from "@/lib/day";
import { splitDayNote } from "@/lib/daynote";
import { parseQuizIds } from "@/lib/srs/daysection";
import { readCards, readSubmissions, readReviews } from "@/lib/srs/store";
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
// If it hasn't run yet (or ever), FALL BACK to selecting due + new cards live
// from the bank — the same selectDaily logic the ingest uses — so there is
// always a quiz to do as long as the bank has cards. Unanswered/overdue cards
// resurface here automatically (they're never penalized); the ingest's curated
// block still wins whenever it exists.
export async function GET(req: Request) {
  if (!readAuthorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const stem = todayStem();
  const [bank, subs, reviews] = await Promise.all([readCards(), readSubmissions(), readReviews()]);
  const f = await readVaultFile(`sources/daily/${stem}.md`);
  const body = f ? matter(f.content).content : "";
  let ids = parseQuizIds(splitDayNote(body).quiz);
  let generated = false;
  if (!ids.length) {
    const cap = Number(process.env.QUIZ_DAILY_CAP || "20");
    ids = selectDaily(Object.values(bank), { max: cap }).map((c) => c.id);
    generated = ids.length > 0;
  }
  const cards = ids.map((id) => bank[id]).filter((c): c is Card => !!c && !c.suspended).map(publicOf);
  // Already-answered-today cards (still in the ungraded queue) so the UI can skip them.
  const pending = new Set(subs.map((s) => s.card_id));
  // Ingest consumes submissions. Already-graded answers must still count as
  // completed today, otherwise rerunning ingest resurrects a finished quiz.
  const date = todayISO();
  const localDate = new Intl.DateTimeFormat("en-CA", {timeZone:"America/New_York", year:"numeric", month:"2-digit", day:"2-digit"});
  for (const review of reviews) {
    const answered = new Date(review.ts);
    if (Number.isFinite(answered.getTime()) && localDate.format(answered) === date) pending.add(review.card_id);
  }
  const submittedIds = ids.filter((id) => pending.has(id));
  return NextResponse.json(
    { stem, cards, submittedIds, generated },
    { headers: { "Cache-Control": "no-store" } },
  );
}
