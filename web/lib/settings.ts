"use client";
import { brainSvg } from "./brainmark";

// User preferences — theme, tab order, Overview widget layout, and locally-held
// integration credentials. Everything lives in the BROWSER (localStorage), never
// in git and never on the server: preferences are per-device, and tokens you
// paste here stay on the machine you paste them on.
//
// Components subscribe with useSettings() (useSyncExternalStore), so the header,
// the settings page, and the dashboard all stay in lockstep.
import { useSyncExternalStore } from "react";

export const SETTINGS_KEY = "cortex:settings";
export const CREDS_KEY = "cortex:credentials";

import { DEFAULT_THEME, normalizeTheme, type ThemeId } from "./themes";
export { THEMES, isTheme, type ThemeId, type ThemeDef } from "./themes";

// ---------- tabs ----------
export type TabKey =
  | "overview"
  | "today"
  | "daily"
  | "docs"
  | "calendar"
  | "wiki"
  | "agent"
  | "tasks"
  | "log";

export const TAB_LABEL: Record<TabKey, string> = {
  overview: "Overview",
  today: "Today",
  daily: "Daily",
  docs: "Docs",
  calendar: "Calendar",
  wiki: "Wiki",
  agent: "Agent",
  tasks: "Tasks",
  log: "Activity",
};

export const ALL_TABS: TabKey[] = [
  "overview",
  "today",
  "daily",
  "docs",
  "calendar",
  "wiki",
  "agent",
  "tasks",
  "log",
];

// ---------- overview widgets ----------
export type WidgetKey =
  | "streak"
  | "tasks"
  | "today"
  | "knowledge"
  | "planned"
  | "recentDocs"
  | "activity"
  | "recall";

export const WIDGET_META: Record<WidgetKey, { label: string; hint: string; wide?: boolean }> = {
  streak: { label: "Daily streak", hint: "Writing streak + a 3-week heat strip" },
  tasks: { label: "Task progress", hint: "Completion, open/overdue/high counts" },
  today: { label: "Today's note", hint: "Whether today's note exists, with a jump-in button" },
  knowledge: { label: "Knowledge base", hint: "Page / task / note totals" },
  planned: { label: "Upcoming deliverables", hint: "The agent's next Planned calendar items" },
  recentDocs: { label: "Recent documents", hint: "Most recently edited Docs" },
  activity: { label: "Recent activity", hint: "Latest entries from the op log", wide: true },
  recall: { label: "Recall dashboard", hint: "Retention, forecast, calibration", wide: true },
};

/** Apple-style widget sizes, expressed as column span. 3 = full row. */
export type WidgetSpan = 1 | 2 | 3;

export const SPAN_LABEL: Record<WidgetSpan, string> = { 1: "S", 2: "M", 3: "L" };

export const DEFAULT_SPANS: Record<WidgetKey, WidgetSpan> = {
  streak: 1,
  tasks: 1,
  today: 1,
  knowledge: 1,
  planned: 1,
  recentDocs: 1,
  activity: 3,
  recall: 3,
};

export const ALL_WIDGETS: WidgetKey[] = [
  "streak",
  "tasks",
  "today",
  "knowledge",
  "planned",
  "recentDocs",
  "activity",
  "recall",
];

// ---------- shape ----------
export type Settings = {
  theme: ThemeId;
  tabOrder: TabKey[];
  hiddenTabs: TabKey[];
  widgetOrder: WidgetKey[];
  hiddenWidgets: WidgetKey[];
  /** Per-widget size (column span), set by dragging on the Overview board. */
  widgetSpans: Record<WidgetKey, WidgetSpan>;
  /** Overview cards per row on desktop (2 or 3). */
  density: 2 | 3;
};

export const DEFAULT_SETTINGS: Settings = {
  theme: DEFAULT_THEME,
  tabOrder: [...ALL_TABS],
  hiddenTabs: [],
  // Everything on by default; the point of the board is that you prune it.
  widgetOrder: [...ALL_WIDGETS],
  hiddenWidgets: [],
  widgetSpans: { ...DEFAULT_SPANS },
  density: 2,
};

/** Merge a stored blob with defaults, dropping unknown keys and re-adding new ones. */
export function normalize(raw: unknown): Settings {
  const s = (raw ?? {}) as Partial<Settings>;
  const order = <T extends string>(stored: unknown, all: T[]): T[] => {
    const arr = Array.isArray(stored) ? (stored as T[]).filter((k) => all.includes(k)) : [];
    // append anything new the app has added since the settings were saved
    return [...arr, ...all.filter((k) => !arr.includes(k))];
  };
  // An absent key means "never set" → take the default. An empty array is a real
  // choice (nothing hidden) and must survive normalization.
  const subset = <T extends string>(stored: unknown, all: T[], fallback: T[]): T[] =>
    Array.isArray(stored) ? (stored as T[]).filter((k) => all.includes(k)) : fallback;
  // Sizes fall back per-widget, so a newly-added widget still gets a sane span.
  const spans = (stored: unknown): Record<WidgetKey, WidgetSpan> => {
    const out = { ...DEFAULT_SPANS };
    const o = (stored ?? {}) as Record<string, unknown>;
    for (const k of ALL_WIDGETS) {
      const v = o[k];
      if (v === 1 || v === 2 || v === 3) out[k] = v;
    }
    return out;
  };

  return {
    theme: normalizeTheme(s.theme),
    tabOrder: order(s.tabOrder, ALL_TABS),
    // never let every tab be hidden — Overview always stays reachable
    hiddenTabs: subset(s.hiddenTabs, ALL_TABS, DEFAULT_SETTINGS.hiddenTabs).filter(
      (t) => t !== "overview",
    ),
    widgetOrder: order(s.widgetOrder, ALL_WIDGETS),
    hiddenWidgets: subset(s.hiddenWidgets, ALL_WIDGETS, DEFAULT_SETTINGS.hiddenWidgets),
    widgetSpans: spans(s.widgetSpans),
    density: s.density === 3 ? 3 : 2,
  };
}

// ---------- store ----------
let current: Settings = DEFAULT_SETTINGS;
let hydrated = false;
const listeners = new Set<() => void>();

function read(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    return normalize(raw ? JSON.parse(raw) : {});
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function emit() {
  for (const l of listeners) l();
}

/** Apply the theme to <html> so the CSS variable set switches. */
export function applyTheme(theme: ThemeId) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  const colors = getComputedStyle(document.documentElement);
  const accent = colors.getPropertyValue("--accent").trim() || "#0091ff";
  const background = colors.getPropertyValue("--bg").trim() || "#1c1c1e";
  const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]') || document.createElement("link");
  icon.rel = "icon";
  icon.type = "image/svg+xml";
  icon.href = `data:image/svg+xml,${encodeURIComponent(brainSvg(accent, background))}`;
  if (!icon.isConnected) document.head.appendChild(icon);
}

export function getSettings(): Settings {
  if (!hydrated && typeof window !== "undefined") {
    current = read();
    hydrated = true;
  }
  return current;
}

export function setSettings(patch: Partial<Settings> | ((s: Settings) => Partial<Settings>)) {
  const base = getSettings();
  const next = normalize({ ...base, ...(typeof patch === "function" ? patch(base) : patch) });
  current = next;
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {
    /* private mode / quota — keep the in-memory value */
  }
  applyTheme(next.theme);
  emit();
}

export function resetSettings() {
  current = DEFAULT_SETTINGS;
  try {
    window.localStorage.removeItem(SETTINGS_KEY);
  } catch {
    /* ignore */
  }
  applyTheme(DEFAULT_SETTINGS.theme);
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  // another tab changed settings → adopt them
  const onStorage = (e: StorageEvent) => {
    if (e.key === SETTINGS_KEY) {
      current = read();
      applyTheme(current.theme);
      emit();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings, () => DEFAULT_SETTINGS);
}

// ---------- ordering helpers (shared by the settings UI) ----------
export function move<T>(list: T[], item: T, dir: -1 | 1): T[] {
  const i = list.indexOf(item);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return list;
  const out = [...list];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

export function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

// ---------- credentials (browser-only) ----------
export type Credentials = {
  /** Notion internal-integration secret (ntn_… / secret_…). */
  notionToken: string;
  /** Optional shared secret for this deployment's write API (API_TOKEN). */
  apiToken: string;
};

export const EMPTY_CREDS: Credentials = { notionToken: "", apiToken: "" };

export function getCredentials(): Credentials {
  if (typeof window === "undefined") return EMPTY_CREDS;
  try {
    const raw = window.localStorage.getItem(CREDS_KEY);
    const o = raw ? (JSON.parse(raw) as Partial<Credentials>) : {};
    return {
      notionToken: typeof o.notionToken === "string" ? o.notionToken : "",
      apiToken: typeof o.apiToken === "string" ? o.apiToken : "",
    };
  } catch {
    return EMPTY_CREDS;
  }
}

export function setCredentials(next: Credentials) {
  try {
    window.localStorage.setItem(CREDS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function clearCredentials() {
  try {
    window.localStorage.removeItem(CREDS_KEY);
  } catch {
    /* ignore */
  }
}

/** "ntn_abc…xyz" → "ntn_abc••••xyz" for display. */
export function maskToken(t: string): string {
  if (!t) return "";
  if (t.length <= 12) return "•".repeat(t.length);
  return `${t.slice(0, 7)}${"•".repeat(8)}${t.slice(-4)}`;
}
