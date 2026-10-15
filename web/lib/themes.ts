// ---------- themes ----------
export type ThemeId =
  | "slate"
  | "porcelain"
  | "dune"
  | "sage"
  | "graphite"
  | "nord"
  | "mono"
  | "parchment"
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
    id: "slate",
    label: "Apple Dark",
    hint: "Apple system colors · dark appearance",
    swatch: ["#1c1c1e", "#2c2c2e", "#0091ff"],
    dark: true,
  },
  {
    id: "porcelain",
    label: "Apple Light",
    hint: "Apple system colors · light appearance",
    swatch: ["#f2f2f7", "#ffffff", "#0088ff"],
    dark: false,
  },
  {
    id: "dune",
    label: "Dune",
    hint: "Warm stone, understated champagne",
    swatch: ["#211f1c", "#302d29", "#ccb79a"],
    dark: true,
  },
  {
    id: "sage",
    label: "Sage",
    hint: "Pale mineral, muted botanical accents",
    swatch: ["#f2f5f1", "#fafcf9", "#45634f"],
    dark: false,
  },
  {
    id: "graphite",
    label: "Graphite",
    hint: "Neutral slate with a warm amber accent",
    swatch: ["#121212", "#1f1f1f", "#e0a458"],
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
    id: "daylight",
    label: "Daylight",
    hint: "Crisp white with a clear blue accent",
    swatch: ["#f6f7f9", "#ffffff", "#2f6fd0"],
    dark: false,
  },
];

export const isTheme = (v: unknown): v is ThemeId =>
  typeof v === "string" && THEMES.some((t) => t.id === v);

export const DEFAULT_THEME: ThemeId = "slate";
const RETIRED_THEMES: Record<string, ThemeId> = {
  notebook: "dune", midnight: "slate", plum: "slate", forest: "sage",
  ocean: "slate", ember: "dune", sepia: "porcelain",
};
export function normalizeTheme(value: unknown): ThemeId {
  if (isTheme(value)) return value;
  return typeof value === "string" && Object.hasOwn(RETIRED_THEMES, value)
    ? RETIRED_THEMES[value] : DEFAULT_THEME;
}

// The same migration runs before first paint and when preferences hydrate.
export const THEME_BOOT = `(function(){try{var s=JSON.parse(localStorage.getItem('cortex:settings')||'{}');var t=s.theme;var ids=${JSON.stringify(THEMES.map(t => t.id))};var retired=${JSON.stringify(RETIRED_THEMES)};document.documentElement.setAttribute('data-theme',ids.includes(t)?t:(Object.prototype.hasOwnProperty.call(retired,t)?retired[t]:${JSON.stringify(DEFAULT_THEME)}));}catch(e){}})()`;
