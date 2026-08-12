import type { CalEvent } from "./types";
import type { PlannedEvent } from "@/lib/types";

const day = (s: string) => s.slice(0, 10);

// Project git-backed planned deliverables into CalEvents overlapping [start, end].
// These are read-only (no OAuth provider) — the ingest owns them in the repo.
export function plannedToEvents(
  planned: PlannedEvent[],
  startISO: string,
  endISO: string,
): CalEvent[] {
  const lo = day(startISO);
  const hi = day(endISO);
  return planned
    .filter((p) => {
      const s = day(p.date);
      const e = day(p.end || p.date);
      return e >= lo && s <= hi; // overlaps the visible range
    })
    .map((p) => {
      const allDay = p.allDay !== false;
      const start = allDay ? `${day(p.date)}T00:00:00Z` : p.date;
      const end = allDay ? `${day(p.end || p.date)}T00:00:00Z` : p.end || p.date;
      const description =
        [p.kind, p.project && `project: ${p.project}`, p.note].filter(Boolean).join(" · ") ||
        undefined;
      return {
        id: `planned:${p.id}`,
        provider: "planned" as const,
        calendarId: "planned",
        title: p.title,
        start,
        end,
        allDay,
        description,
      };
    });
}
