// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// Mock the network transcription call so the hook is tested in isolation.
vi.mock("@/lib/clientapi", () => ({
  transcribeAudio: vi.fn(async () => "hello from voice"),
}));
import { transcribeAudio } from "@/lib/clientapi";
import { useVoiceRecorder } from "@/lib/useVoiceRecorder";

// Minimal MediaRecorder stand-in: stop() emits one chunk then fires onstop.
class FakeMediaRecorder {
  static isTypeSupported() {
    return true;
  }
  state: "inactive" | "recording" = "inactive";
  mimeType = "audio/webm";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(public stream: any) {}
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["x"], { type: "audio/webm" }) });
    this.onstop?.();
  }
}

function setGetUserMedia(fn: () => Promise<unknown>) {
  Object.defineProperty(navigator, "mediaDevices", {
    value: { getUserMedia: vi.fn(fn) },
    configurable: true,
  });
}

beforeEach(() => {
  vi.stubGlobal("MediaRecorder", FakeMediaRecorder as unknown as typeof MediaRecorder);
  const track = { stop: vi.fn() };
  setGetUserMedia(async () => ({ getTracks: () => [track] }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("useVoiceRecorder", () => {
  it("reports supported when the APIs exist", () => {
    const { result } = renderHook(() => useVoiceRecorder(vi.fn()));
    expect(result.current.supported).toBe(true);
    expect(result.current.state).toBe("idle");
  });

  it("records, transcribes, and delivers the text", async () => {
    const onText = vi.fn();
    const { result } = renderHook(() => useVoiceRecorder(onText));

    await act(async () => {
      await result.current.start();
    });
    expect(result.current.state).toBe("recording");

    await act(async () => {
      result.current.stop();
    });
    await waitFor(() => expect(result.current.state).toBe("idle"));

    expect(transcribeAudio).toHaveBeenCalledOnce();
    expect(onText).toHaveBeenCalledWith("hello from voice");
  });

  it("surfaces a clear error when mic permission is denied", async () => {
    setGetUserMedia(async () => {
      const e = new Error("denied");
      e.name = "NotAllowedError";
      throw e;
    });
    const { result } = renderHook(() => useVoiceRecorder(vi.fn()));
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.state).toBe("error");
    expect(result.current.error).toMatch(/permission/i);
  });
});

// When the browser has the Web Speech API, the hook uses it (on-device, no key)
// instead of the MediaRecorder→server path.
describe("useVoiceRecorder — Web Speech engine", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let inst: any;

  class FakeSpeechRecognition {
    lang = "";
    continuous = false;
    interimResults = false;
    onresult: ((e: unknown) => void) | null = null;
    onerror: ((e: { error?: string }) => void) | null = null;
    onend: (() => void) | null = null;
    constructor() {
      inst = this;
    }
    start() {}
    stop() {
      this.onend?.();
    }
    abort() {}
    emitFinal(t: string) {
      this.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: t } }] });
    }
  }

  beforeEach(() => {
    vi.stubGlobal("SpeechRecognition", FakeSpeechRecognition as unknown as typeof SpeechRecognition);
  });

  it("uses live recognition and emits the transcript on stop", async () => {
    const onText = vi.fn();
    const { result } = renderHook(() => useVoiceRecorder(onText));
    expect(result.current.supported).toBe(true);

    await act(async () => {
      await result.current.start();
    });
    expect(result.current.state).toBe("recording");

    act(() => inst.emitFinal("spoken words here"));
    await act(async () => {
      result.current.stop();
    });
    await waitFor(() => expect(result.current.state).toBe("idle"));
    expect(onText).toHaveBeenCalledWith("spoken words here");
  });
});
