"use client";

// Voice capture for notes, with two engines and automatic selection:
//
//   1. Browser Web Speech API (webkitSpeechRecognition) — on-device, FREE, no
//      API key or provider. Used when available (Chrome desktop, Safari incl.
//      iOS). This is the default so voice notes work with zero setup.
//   2. MediaRecorder → /api/transcribe (server Whisper) — fallback for browsers
//      without Web Speech, if an STT key is configured server-side.
//
// Either way the transcript is handed to `onText`.
import { useCallback, useEffect, useRef, useState } from "react";
import { transcribeAudio } from "./clientapi";

export type RecorderState = "idle" | "recording" | "transcribing" | "error";

const MAX_SECONDS = 180; // hard cap so a forgotten recording can't run away

// ---- Web Speech API (minimal typings; not in lib.dom) ---------------------
interface SpeechResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechEvent {
  resultIndex: number;
  results: ArrayLike<SpeechResult>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechEvent) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechCtor = new () => SpeechRecognitionLike;

function getSpeechCtor(): SpeechCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechCtor;
    webkitSpeechRecognition?: SpeechCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

// ---- MediaRecorder fallback -----------------------------------------------
const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/mpeg"];
function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const m of MIME_CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch {
      /* ignore and try the next */
    }
  }
  return undefined;
}

export function useVoiceRecorder(onText: (text: string) => void) {
  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);

  // shared
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // web speech
  const speechRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef("");
  // media recorder
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const hasSpeech = typeof window !== "undefined" && getSpeechCtor() !== null;
  const hasRecorder =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";
  const supported = hasSpeech || hasRecorder;

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cleanupRecorder = useCallback(() => {
    stopTimer();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }, [stopTimer]);

  const startTimer = useCallback(() => {
    setSeconds(0);
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        const next = s + 1;
        if (next >= MAX_SECONDS) stopRef.current();
        return next;
      });
    }, 1000);
  }, []);

  // ---- engine: Web Speech ----
  const startSpeech = useCallback(
    (Ctor: SpeechCtor) => {
      const rec = new Ctor();
      speechRef.current = rec;
      transcriptRef.current = "";
      rec.lang = "en-US";
      rec.continuous = true;
      rec.interimResults = false;
      rec.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) transcriptRef.current += (transcriptRef.current ? " " : "") + r[0].transcript.trim();
        }
      };
      rec.onerror = (e) => {
        stopTimer();
        speechRef.current = null;
        setError(
          e.error === "not-allowed" || e.error === "service-not-allowed"
            ? "Microphone permission denied."
            : e.error === "no-speech"
              ? "Didn't catch that — try again."
              : `Voice recognition error: ${e.error ?? "unknown"}`,
        );
        setState("error");
      };
      rec.onend = () => {
        stopTimer();
        speechRef.current = null;
        const text = transcriptRef.current.trim();
        setState("idle");
        if (text) onText(text);
      };
      rec.start();
      setState("recording");
      startTimer();
    },
    [onText, startTimer, stopTimer],
  );

  // ---- engine: MediaRecorder → server ----
  const startRecorder = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const mime = pickMime();
    const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    recorderRef.current = rec;
    chunksRef.current = [];
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = async () => {
      const type = rec.mimeType || mime || "audio/webm";
      const blob = new Blob(chunksRef.current, { type });
      cleanupRecorder();
      if (blob.size === 0) {
        setState("idle");
        return;
      }
      setState("transcribing");
      try {
        const text = await transcribeAudio(blob);
        setState("idle");
        if (text) onText(text);
      } catch (e) {
        setError((e as Error).message);
        setState("error");
      }
    };
    rec.start();
    setState("recording");
    startTimer();
  }, [onText, startTimer, cleanupRecorder]);

  const start = useCallback(async () => {
    setError("");
    const Ctor = getSpeechCtor();
    try {
      if (Ctor) startSpeech(Ctor);
      else if (hasRecorder) await startRecorder();
      else {
        setError("Voice recording isn't supported in this browser.");
        setState("error");
      }
    } catch (e) {
      const name = (e as Error).name;
      setError(
        name === "NotAllowedError" || name === "SecurityError"
          ? "Microphone permission denied."
          : (e as Error).message || "Couldn't start recording.",
      );
      setState("error");
      cleanupRecorder();
    }
  }, [startSpeech, startRecorder, hasRecorder, cleanupRecorder]);

  const stop = useCallback(() => {
    stopTimer();
    if (speechRef.current) {
      speechRef.current.stop(); // → onend → onText
      return;
    }
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop(); // → onstop → transcribe
  }, [stopTimer]);

  // keep a live ref to stop() for the auto-stop timer
  const stopRef = useRef(stop);
  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);

  // stop everything on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      try {
        speechRef.current?.abort();
      } catch {
        /* ignore */
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [stopTimer]);

  return { state, error, seconds, supported, start, stop };
}
