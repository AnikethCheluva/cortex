import { NextResponse } from "next/server";
import matter from "gray-matter";
import { readVaultFile } from "@/lib/storage";
import { splitDayNote } from "@/lib/daynote";
import { parseQuizIds } from "@/lib/srs/daysection";
import { readCards } from "@/lib/srs/store";
import type { Card } from "@/lib/srs/types";

export const dynamic = "force-dynamic";

// GET → a given day's quiz for READ-ONLY review in the Daily tab. Includes the
// reference answer + rubric (the day is a historical snapshot, so revealing is
// fine). Today's note is answered interactively via /api/quiz/today instead.
export async function GET(_req: Request, { params }: { params: Promise<{ stem: string }> }) {
  const { stem } = await params;
  if (stem.includes("/") || stem.includes("..")) {
    return NextResponse.json({ error: "bad stem" }, { status: 400 });
  }
  const f = await readVaultFile(`sources/daily/${stem}.md`);
  const body = f ? matter(f.content).content : "";
  const ids = parseQuizIds(splitDayNote(body).quiz);
  if (!ids.length) {
    return NextResponse.json({ stem, cards: [] }, { headers: { "Cache-Control": "no-store" } });
  }
  const bank = await readCards();
  const cards = ids
    .map((id) => bank[id])
    .filter((c): c is Card => !!c)
    .map((c) => ({
      id: c.id,
      stem: c.stem,
      topic: c.topic,
      type: c.type,
      source_file: c.source_file,
      referenceAnswer: c.reference_answer,
      requiredPoints: c.required_points,
    }));
  return NextResponse.json({ stem, cards }, { headers: { "Cache-Control": "no-store" } });
}
