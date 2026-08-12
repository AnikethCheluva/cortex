import { NextResponse } from "next/server";
import { getCard, appendSubmission } from "@/lib/srs/store";
import { apiAuthorized, unauthorized } from "@/lib/apiauth";
import type { Submission } from "@/lib/srs/types";

export const dynamic = "force-dynamic";

// POST { cardId, answer, confidence, durationMs } → queue the answer (UNGRADED)
// and reveal the reference answer + rubric. No API key here: the ingest grades
// the queued answers later and advances the FSRS schedule.
export async function POST(req: Request) {
  if (!apiAuthorized(req)) return NextResponse.json(unauthorized(), { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "expected JSON body" }, { status: 400 });
  }
  const cardId = String(body?.cardId ?? "");
  if (!cardId) return NextResponse.json({ error: "cardId required" }, { status: 400 });

  const card = await getCard(cardId);
  if (!card) return NextResponse.json({ error: "card not found" }, { status: 404 });

  const submission: Submission = {
    card_id: cardId,
    ts: new Date().toISOString(),
    user_answer: String(body?.answer ?? ""),
    confidence: Math.min(1, Math.max(0, Number(body?.confidence ?? 0.5))),
    duration_ms: Number.isFinite(Number(body?.durationMs)) ? Number(body.durationMs) : undefined,
  };
  await appendSubmission(submission, `srs: answer ${cardId}`);

  return NextResponse.json(
    {
      referenceAnswer: card.reference_answer,
      requiredPoints: card.required_points,
      sourceFile: card.source_file,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
