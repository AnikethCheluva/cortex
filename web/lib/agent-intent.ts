/** Separate concise vault searches from requests that need an agent response. */
export function isAgentPrompt(value: string): boolean {
  const text = value.trim();
  if (!text) return false;
  if (text.startsWith(">")) return true;
  if (text.endsWith("?")) return true;
  if (text.split(/\s+/).length >= 9) return true;
  return /^(help|please|can you|could you|i want|i need|plan|make|build|write|draft|review|summarize|explain|organize|schedule|timebox|create|add|fix)\b/i.test(text);
}

/** Commands that should use Cortex's real task planner instead of chat. */
export function isTimeboxCommand(value: string): boolean {
  const text = value.trim();
  if (!text) return false;
  return /\b(?:time\s*box|schedule|plan)\b[\s\S]*\b(?:tasks?|calendar)\b|\b(?:tasks?)\b[\s\S]*\b(?:time\s*box|schedule)\b/i.test(text);
}
