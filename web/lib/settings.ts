"use client";

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

// ---------- themes ----------
export type ThemeId =
  | "notebook"
  | "midnight"
  | "graphite"
  | "forest"
  | "plum"
  | "ocean"
  | "ember"
  | "nord"
  | "mono"
  | "parchment"
  | "sepia"
  | "daylight";

export type ThemeDef = {
  id: ThemeId;
  label: string;
  hint: string;
  /** swatch preview: [background, panel, accent] */
  swatch: [string, string, string];
  dark: boolean;
};

export const THEMES: ThemeDef[] = [
  {
    id: "notebook",
    label: "Notebook",
    hint: "Warm charcoal + brass — the original",
    swatch: ["#14130d", "#232118", "#d8b15a"],
    dark: true,
  },
  {
    id: "midnight",
    label: "Midnight",
    hint: "Deep navy with an ice-blue accent",
    swatch: ["#0d1117", "#182130", "#6aa6f0"],
    dark: true,
  },
  {
    id: "graphite",
    label: "Graphite",
    hint: "Neutral slate with a warm amber accent",
    swatch: ["#121212", "#1f1f1f", "#e0a458"],
    dark: true,
  },
  {
    id: "forest",
    label: "Forest",
    hint: "Deep green with a sage accent",
    swatch: ["#0e1410", "#1a231c", "#7fbf8f"],
    dark: true,
  },
  {
    id: "plum",
    label: "Plum",
    hint: "Dark aubergine with a rose accent",
    swatch: ["#14101a", "#221c2c", "#c99bd8"],
    dark: true,
  },
  {
    id: "ocean",
    label: "Ocean",
    hint: "Deep teal with a cyan accent",
    swatch: ["#071316", "#10272d", "#4fc3d9"],
    dark: true,
  },
  {
    id: "ember",
    label: "Ember",
    hint: "Warm dark with a burnt-orange accent",
    swatch: ["#17100d", "#291e17", "#ff8c5a"],
    dark: true,
  },
  {
    id: "nord",
    label: "Nord",
    hint: "Cool blue-grey, low contrast",
    swatch: ["#2e3440", "#434c5e", "#88c0d0"],
    dark: true,
  },
  {
    id: "mono",
    label: "Mono",
    hint: "Pure greyscale, maximum contrast",
    swatch: ["#0a0a0a", "#1d1d1d", "#ffffff"],
    dark: true,
  },
  {
    id: "parchment",
    label: "Parchment",
    hint: "Light cream paper with ink-brown type",
    swatch: ["#f4efe2", "#fbf8f0", "#8a6a2f"],
    dark: false,
  },
  {
    id: "sepia",
    label: "Sepia",
    hint: "Aged paper, warm brown ink",
    swatch: ["#f1e7d5", "#f8f1e3", "#9c5f24"],
    dark: false,
  },
  {
    id: "daylight",
    label: "Daylight",
    hint: "Crisp white with a clear blue accent",
    swatch: ["#f6f7f9", "#ffffff", "#2f6fd0"],
    dark: false,
  },
];

export const isTheme = (v: unknown): v is ThemeId =>
  typeof v === "string" && THEMES.some((t) => t.id === v);

// ---------- tabs ----------
export type TabKey =
  | "overview"
  | "today"
  | "daily"
  | "docs"
  | "calendar"
  | "wiki"
  | "tasks"
  | "log";

export const TAB_LABEL: Record<TabKey, string> = {
  overview: "Overview",
  today: "Today",
  daily: "Daily",
  docs: "Docs",
  calendar: "Calendar",
  wiki: "Wiki",
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
  /** Overview cards per row on desktop (2 or 3). */
  density: 2 | 3;
};

export const DEFAULT_SETTINGS: Settings = {
  theme: "notebook",
  tabOrder: [...ALL_TABS],
  hiddenTabs: [],
  // Everything on by default; the point of the board is that you prune it.
  widgetOrder: [...ALL_WIDGETS],
  hiddenWidgets: [],
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

  return {
    theme: isTheme(s.theme) ? s.theme : DEFAULT_SETTINGS.theme,
    tabOrder: order(s.tabOrder, ALL_TABS),
    // never let every tab be hidden — Overview always stays reachable
    hiddenTabs: subset(s.hiddenTabs, ALL_TABS, DEFAULT_SETTINGS.hiddenTabs).filter(
      (t) => t !== "overview",
    ),
    widgetOrder: order(s.widgetOrder, ALL_WIDGETS),
    hiddenWidgets: subset(s.hiddenWidgets, ALL_WIDGETS, DEFAULT_SETTINGS.hiddenWidgets),
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
