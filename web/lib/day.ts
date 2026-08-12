// Date helpers shared by server + client. "Today" is always resolved in
// America/New_York (the app's configured timezone) — NOT the server's clock. Vercel runs
// in UTC, so without this the daily note rolls to "tomorrow" every evening EST.
// The vault names daily notes "M-D-YY.md" (no zero-padding) with a
// `Created: YYYY-MM-DD` frontmatter, so we expose both forms.

const TZ = "America/New_York";

/** {y, m, day} for a Date as seen in New York (defaults to now). */
function nyYMD(d: Date = new Date()): { y: number; m: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { y: get("year"), m: get("month"), day: get("day") };
}

/** Today as YYYY-MM-DD in New York time. */
export function todayISO(): string {
  const { y, m, day } = nyYMD();
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Today's daily-note filename stem in New York time, e.g. "6-26-26". */
export function todayStem(): string {
  const { y, m, day } = nyYMD();
  return `${m}-${day}-${String(y).slice(-2)}`;
}

/** Long human label for a YYYY-MM-DD, e.g. "Friday, June 26, 2026". The date is
 *  treated as a fixed calendar day (formatted in UTC) so the weekday is stable
 *  regardless of where the code runs. */
export function prettyISO(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** A daily-note filename stem (M-D-YY, e.g. "6-26-26", or ISO "2026-06-26") →
 *  its normalized ISO date + long label. Shared by the build-time reader
 *  (lib/vault.ts) and the Convex sync (convex/sync.ts) so the two never drift.
 *  Unrecognized stem → empty iso, with the raw stem as the label. */
export function dailyDate(stem: string): { iso: string; label: string } {
  const iso = stem.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const mdy = stem.match(/^(\d{1,2})-(\d{1,2})-(\d{2})$/);
  let norm = "";
  if (iso) norm = `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  else if (mdy) norm = `20${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  if (!norm) return { iso: "", label: stem };
  return { iso: norm, label: prettyISO(norm) };
}
