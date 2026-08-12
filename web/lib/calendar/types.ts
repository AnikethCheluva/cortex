// Unified calendar model across Google Calendar + Microsoft Graph. All times are
// ISO strings (UTC for timed events; a YYYY-MM-DD-anchored ISO for all-day).
// "planned" is the agent's git-backed deliverable overlay (not an OAuth source).
export type CalProvider = "google" | "microsoft" | "planned";

export type CalEvent = {
  id: string;
  provider: CalProvider;
  calendarId: string;
  title: string;
  start: string; // ISO
  end: string; // ISO
  allDay: boolean;
  location?: string;
  description?: string;
  link?: string; // htmlLink / webLink to open in the provider
  color?: string; // provider/calendar accent (optional)
};

export type NewEvent = {
  provider: CalProvider;
  title: string;
  start: string; // ISO (UTC)
  end: string; // ISO (UTC)
  allDay: boolean;
  location?: string;
  description?: string;
};

export const PROVIDER_LABEL: Record<CalProvider, string> = {
  google: "Google",
  microsoft: "Outlook",
  planned: "Planned",
};
