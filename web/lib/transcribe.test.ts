import { describe, it, expect, vi } from "vitest";
import {
  sttConfig,
  extForMime,
  transcribeBlob,
  handleTranscribe,
  TranscribeError,
  type SttConfig,
} from "@/lib/transcribe";

describe("sttConfig", () => {
  it("returns null when no key is set", () => {
    expect(sttConfig({} as NodeJS.ProcessEnv)).toBeNull();
  });
  it("defaults base URL + model to OpenAI Whisper", () => {
    expect(sttConfig({ STT_API_KEY: "k" } as unknown as NodeJS.ProcessEnv)).toEqual({
      key: "k",
      baseUrl: "https://api.openai.com/v1",
      model: "whisper-1",
    });
  });
  it("honors overrides and strips a trailing slash", () => {
    expect(
      sttConfig({
        STT_API_KEY: "k",
        STT_BASE_URL: "https://api.groq.com/openai/v1/",
        STT_MODEL: "whisper-large-v3",
      } as unknown as NodeJS.ProcessEnv),
    ).toEqual({ key: "k", baseUrl: "https://api.groq.com/openai/v1", model: "whisper-large-v3" });
  });
});

describe("extForMime", () => {
  it("maps recorder mime types to extensions", () => {
    expect(extForMime("audio/webm;codecs=opus")).toBe("webm");
    expect(extForMime("audio/mp4")).toBe("mp4");
    expect(extForMime("audio/mpeg")).toBe("mp3");
    expect(extForMime("audio/ogg")).toBe("ogg");
  });
  it("defaults to webm for unknown/empty", () => {
    expect(extForMime(undefined)).toBe("webm");
    expect(extForMime("audio/weird")).toBe("webm");
  });
});

const cfg: SttConfig = { key: "k", baseUrl: "https://x/v1", model: "whisper-1" };

describe("transcribeBlob", () => {
  it("posts the audio to the provider and returns trimmed text", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ text: "  hello world  " }), { status: 200 }),
    );
    const text = await transcribeBlob(
      new Blob(["x"], { type: "audio/webm" }),
      cfg,
      fetchMock as unknown as typeof fetch,
    );
    expect(text).toBe("hello world");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://x/v1/audio/transcriptions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer k");
    expect(init.body).toBeInstanceOf(FormData);
  });

  it("throws a 502 TranscribeError when the provider errors", async () => {
    const fetchMock = vi.fn(async () => new Response("bad key", { status: 401 }));
    await expect(
      transcribeBlob(new Blob(["x"], { type: "audio/webm" }), cfg, fetchMock as unknown as typeof fetch),
    ).rejects.toMatchObject({ status: 502 });
  });

  it("throws on network failure", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("boom");
    });
    await expect(
      transcribeBlob(new Blob(["x"], { type: "audio/webm" }), cfg, fetchMock as unknown as typeof fetch),
    ).rejects.toBeInstanceOf(TranscribeError);
  });
});

function formReq(audio?: Blob) {
  const form = new FormData();
  if (audio) form.append("audio", audio, "note.webm");
  return new Request("http://t/api/transcribe", { method: "POST", body: form });
}

describe("handleTranscribe", () => {
  it("503 when STT isn't configured", async () => {
    const r = await handleTranscribe(formReq(new Blob(["x"], { type: "audio/webm" })), {
      config: null,
    });
    expect(r.status).toBe(503);
    expect(String(r.body.error)).toMatch(/STT_API_KEY/);
  });

  it("400 when no audio is provided", async () => {
    const r = await handleTranscribe(formReq(), { config: cfg });
    expect(r.status).toBe(400);
  });

  it("200 with the transcript on success", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ text: "note text" }), { status: 200 }),
    );
    const r = await handleTranscribe(formReq(new Blob(["abc"], { type: "audio/webm" })), {
      config: cfg,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ text: "note text" });
  });

  it("propagates the provider error as 502", async () => {
    const fetchMock = vi.fn(async () => new Response("nope", { status: 500 }));
    const r = await handleTranscribe(formReq(new Blob(["abc"], { type: "audio/webm" })), {
      config: cfg,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(r.status).toBe(502);
  });
});
