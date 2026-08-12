import { NextResponse } from "next/server";
import { handleTranscribe } from "@/lib/transcribe";
import { apiAuthorized, unauthorized } from "@/lib/apiauth";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Whisper on a ~1-2 min clip can take a few seconds

// POST multipart form-data with an `audio` file → { text }. Transcribes via the
// configured OpenAI-compatible STT provider; audio is never stored.
export async function POST(req: Request) {
  if (!apiAuthorized(req)) return NextResponse.json(unauthorized(), { status: 401 });
  const { status, body } = await handleTranscribe(req);
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
