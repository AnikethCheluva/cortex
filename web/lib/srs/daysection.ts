// Render / parse the day-note quiz section. The machine-readable payload is the
// `<!-- ids: … -->` comment (the selected card IDs); the numbered list below it
// is just for reading the note in Obsidian. Pure — shared by the generator and
// the "today's quiz" route.
import { QUIZ_MARKER } from "../daynote";

type QuizCardLike = { id: string; stem: string; topic: string };

export function renderQuizSection(cards: QuizCardLike[], label: string): string {
  const ids = cards.map((c) => c.id).join(",");
  const list = cards
    .map((c, i) => `${i + 1}. ${c.topic ? `[${c.topic}] ` : ""}${c.stem}`)
    .join("\n");
  return `${QUIZ_MARKER}\n## Recall quiz — ${label}\n<!-- ids: ${ids} -->\n\n${list}\n`;
}

/** Extract the selected card IDs from a day note's quiz block. */
export function parseQuizIds(md: string): string[] {
  const m = md.match(/<!--\s*ids:\s*([^>]*?)-->/i);
  if (!m) return [];
  return m[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
