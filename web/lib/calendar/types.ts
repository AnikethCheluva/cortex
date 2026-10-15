// Unified calendar model across Google Calendar + Microsoft Graph. All times are
// ISO strings (UTC for timed events; a YYYY-MM-DD-anchored ISO for all-day).
// "planned" is the agent's git-backed deliverable overlay (not an OAuth source).
export type ConnectedProvider = "google" | "microsoft";
export type CalProvider = ConnectedProvider | "planned" | "tasks";

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
  colorId?: string; // Google event palette ID; absent means calendar default
  calendarColor?: string;
  colorReadOnly?: boolean;
  calendarName?: string;
  meetingUrl?: string;
  recurring?: boolean;
  organizer?: string;
  attendees?: { name: string; response?: string }[];
  taskId?: string;
};

export type NewEvent = {
  provider: ConnectedProvider;
  title: string;
  start: string; // ISO (UTC)
  end: string; // ISO (UTC)
  allDay: boolean;
  location?: string;
  description?: string;
  colorId?: string;
};

export const PROVIDER_LABEL: Record<CalProvider, string> = {
  google: "Google",
  microsoft: "Outlook",
  planned: "Planned",
  tasks: "Task deadlines",
};
