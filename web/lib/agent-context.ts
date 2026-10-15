import type { VaultData } from "./types";

const STOP = new Set([
  "a", "an", "and", "are", "can", "do", "for", "from", "help", "how", "i",
  "in", "is", "it", "me", "my", "of", "on", "please", "should", "the", "this",
  "to", "what", "when", "with", "you",
]);

function terms(prompt: string) {
  return [...new Set(prompt.toLowerCase().match(/[a-z0-9-]{3,}/g) ?? [])]
    .filter((term) => !STOP.has(term))
    .slice(0, 12);
}

function score(text: string, words: string[]) {
  const value = text.toLowerCase();
  return words.reduce((total, word) => total + (value.includes(word) ? 1 : 0), 0);
}

/** Compact, user-owned workspace context for a Cortex Command-K request. */
export function buildAgentContext(prompt: string, data: VaultData) {
  const words = terms(prompt);
  const pages = data.wiki
    .map((page) => ({ page, score: score(`${page.title} ${page.summary} ${page.tags.join(" ")} ${page.body}`, words) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ page }) => ({
      title: page.title,
      path: `wiki/pages/${page.slug}.md`,
      summary: page.summary,
      text: page.body.slice(0, 2500),
    }));
  const daily = data.daily
    .map((note) => ({ note, score: score(`${note.label} ${note.preview} ${note.body}`, words) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ note }) => ({
      date: note.date,
      label: note.label,
      text: note.body.slice(0, 1400),
    }));
  const tasks = data.tasks
    .filter((task) => task.status !== "done")
    .slice(0, 30)
    .map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      due: task.due_date,
      project: task.project,
      estimate_minutes: task.estimate_minutes,
      scheduled_at: task.timebox_start,
      notes: task.body.slice(0, 500),
    }));
  return JSON.stringify({ openTasks: tasks, relevantWiki: pages, relevantDailyNotes: daily });
}
