// Server-side speech-to-text for voice notes. Uses an OpenAI-compatible audio
// transcriptions API (works with OpenAI Whisper *or* Groq's whisper-large-v3 —
// just point STT_BASE_URL/STT_MODEL at whichever key you have). Audio is
// forwarded, transcribed, and discarded — nothing is stored, so no database is
// needed. The request-handling core lives here (not in the route) so it's unit-
// testable without pulling in next/server.

export type SttConfig = { key: string; baseUrl: string; model: string };

/** Read STT config from the environment. Returns null when unconfigured so the
 *  route can respond with a clear "not set up" message instead of erroring. */
export function sttConfig(env: NodeJS.ProcessEnv = process.env): SttConfig | null {
  const key = env.STT_API_KEY || "";
  if (!key) return null;
  const baseUrl = (env.STT_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = env.STT_MODEL || "whisper-1";
  return { key, baseUrl, model };
}

// Map a recorded MIME type to a file extension the STT API will accept (OpenAI
// keys off the filename extension). Covers the formats MediaRecorder emits on
// Chrome (webm/opus), Firefox (ogg), and iOS Safari (mp4).
const MIME_EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "mp4",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
};

export function extForMime(mime: string | undefined | null): string {
  if (!mime) return "webm";
  const base = mime.split(";")[0].trim().toLowerCase();
  return MIME_EXT[base] || "webm";
}

export class TranscribeError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB guard (short voice notes are well under)

/** Forward the audio blob to the STT provider; return the transcript text. */
export async function transcribeBlob(
  audio: Blob,
  cfg: SttConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const ext = extForMime(audio.type);
  const form = new FormData();
  form.append("file", audio, `note.${ext}`);
  form.append("model", cfg.model);
  form.append("response_format", "json");

  let res: Response;
  try {
    res = await fetchImpl(`${cfg.baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.key}` },
      body: form,
    });
  } catch (e) {
    throw new TranscribeError(`STT request failed: ${(e as Error).message}`, 502);
  }
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new TranscribeError(`STT provider error ${res.status}: ${detail}`.trim(), 502);
  }
  const data = (await res.json().catch(() => null)) as { text?: string } | null;
  return (data?.text ?? "").trim();
}

export type HandlerResult = { status: number; body: Record<string, unknown> };

/** Pure request handler: validate the upload and transcribe it. The route is a
 *  thin wrapper around this, so all the branches are testable with plain Web
 *  `Request` objects and an injected fetch. */
export async function handleTranscribe(
  req: Request,
  opts: { config?: SttConfig | null; fetchImpl?: typeof fetch } = {},
): Promise<HandlerResult> {
  const cfg = opts.config ?? sttConfig();
  if (!cfg) {
    return {
      status: 503,
      body: {
        error:
          "Voice transcription isn't configured. Set STT_API_KEY (and optionally " +
          "STT_BASE_URL / STT_MODEL) in the environment.",
      },
    };
  }

  let audio: Blob | null = null;
  try {
    const form = await req.formData();
    const f = form.get("audio");
    if (f instanceof Blob) audio = f;
  } catch {
    return { status: 400, body: { error: "expected multipart form-data with an 'audio' file" } };
  }
  if (!audio || audio.size === 0) {
    return { status: 400, body: { error: "no audio provided" } };
  }
  if (audio.size > MAX_BYTES) {
    return { status: 413, body: { error: "audio too large (max 20 MB)" } };
  }

  try {
    const text = await transcribeBlob(audio, cfg, opts.fetchImpl ?? fetch);
    return { status: 200, body: { text } };
  } catch (e) {
    const err = e instanceof TranscribeError ? e : new TranscribeError((e as Error).message);
    return { status: err.status, body: { error: err.message } };
  }
}
