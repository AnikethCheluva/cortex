// Grading helpers. The web app does NOT grade (no API key) — it just captures
// answers and reveals the reference. GRADING happens in the ingest, where Claude
// itself assigns a verdict; these pure helpers turn that verdict into an FSRS
// grade and sanitize the ingest's structured output. Used by the ingest script.
import type { GradeResult, Rating, Verdict } from "./types";

/** Map a verdict to an FSRS grade (1 Again · 2 Hard · 3 Good). */
export function ratingFromVerdict(v: Verdict): Rating {
  return v === "correct" ? 3 : v === "partial" ? 2 : 1;
}

/** Validate/clamp a raw verdict object (from the ingest) into a GradeResult. */
export function normalizeGrade(raw: unknown): GradeResult {
  const o = (raw ?? {}) as Record<string, unknown>;
  const verdict: Verdict = (["correct", "partial", "incorrect"] as const).includes(
    o.verdict as Verdict,
  )
    ? (o.verdict as Verdict)
    : "incorrect";
  const points = Array.isArray(o.points)
    ? (o.points as { point: string; status: GradeResult["points"][number]["status"] }[]).filter(
        (p) => p && typeof p.point === "string",
      )
    : [];
  const confidence = Math.min(1, Math.max(0, Number(o.confidence)));
  return {
    points,
    verdict,
    feedback: typeof o.feedback === "string" ? o.feedback : "",
    confidence: Number.isFinite(confidence) ? confidence : 0.5,
  };
}
