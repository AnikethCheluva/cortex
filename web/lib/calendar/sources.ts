export type GoogleCalendarSource = {
  id: string;
  summary?: string;
  summaryOverride?: string;
  selected?: boolean;
  backgroundColor?: string;
  accessRole?: string;
};

// Canvas is a subscribed Google calendar, not a separate OAuth provider.
export function includeGoogleCalendar(calendar: GoogleCalendarSource): boolean {
  return calendar.selected !== false &&
    ![calendar.summary, calendar.summaryOverride].some((name) => /\bcanvas\b/i.test(name ?? ""));
}
