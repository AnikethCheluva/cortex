import type { CalEvent } from "./types";

// Google's event palette. IDs also serve as stable local choices for other sources.
export const EVENT_COLORS = [
  { id: "1", name: "Lavender", hex: "#a4bdfc" },
  { id: "2", name: "Sage", hex: "#7ae7bf" },
  { id: "3", name: "Grape", hex: "#dbadff" },
  { id: "4", name: "Flamingo", hex: "#ff887c" },
  { id: "5", name: "Banana", hex: "#fbd75b" },
  { id: "6", name: "Tangerine", hex: "#ffb878" },
  { id: "7", name: "Peacock", hex: "#46d6db" },
  { id: "8", name: "Graphite", hex: "#e1e1e1" },
  { id: "9", name: "Blueberry", hex: "#5484ed" },
  { id: "10", name: "Basil", hex: "#51b749" },
  { id: "11", name: "Tomato", hex: "#dc2127" },
] as const;

export const colorHex = (id?: string) => EVENT_COLORS.find((c) => c.id === id)?.hex;
export const eventKey = (event: Pick<CalEvent, "provider" | "calendarId" | "id">) =>
  JSON.stringify([event.provider, event.calendarId, event.id]);
export const COLOR_STORAGE_KEY = "cortex:calendar:event-colors";

export function readEventColors(): Record<string, string> {
  try {
    const value = JSON.parse(localStorage.getItem(COLOR_STORAGE_KEY) || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([, id]) =>
      typeof id === "string" && Boolean(colorHex(id)),
    )) as Record<string, string>;
  } catch {
    return {};
  }
}
