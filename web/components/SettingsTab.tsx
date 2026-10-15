"use client";

// Settings: appearance (themes), layout (tab order, Overview widgets),
// integrations (Notion import), and the account/session controls.
//
// Preferences and tokens live in the BROWSER (localStorage) — see lib/settings.ts.
// Nothing here is written to the repo, so one person's layout never lands in
// someone else's checkout.
import { useCallback, useEffect, useState } from "react";
import {
  ALL_TABS,
  ALL_WIDGETS,
  DEFAULT_SPANS,
  EMPTY_CREDS,
  SPAN_LABEL,
  TAB_LABEL,
  THEMES,
  WIDGET_META,
  clearCredentials,
  getCredentials,
  maskToken,
  move,
  resetSettings,
  setCredentials,
  setSettings,
  toggle,
  useSettings,
  type Credentials,
  type TabKey,
  type ThemeId,
  type WidgetKey,
} from "@/lib/settings";
import { CalendarConnectionSettings } from "./CalendarConnectionSettings";
import { logout } from "./LoginGate";

type NotionItem = { id: string; title: string; type: "page" | "database"; url: string; edited: string };

export function SettingsTab() {
  const s = useSettings();

  return (
    <div className="settings">
      <h2 className="section">Settings</h2>
      <p className="muted set-intro">
        Preferences are saved in this browser only — they never touch the repo.
      </p>

      {/* ---------- appearance ---------- */}
      <section className="set-block">
        <h3 className="set-h">Appearance</h3>
        <p className="set-sub">Pick a palette. It applies instantly and is remembered per device.</p>
        <div className="theme-grid">
          {THEMES.map((t) => (
            <button
              key={t.id}
              className={`theme-card ${s.theme === t.id ? "active" : ""}`}
              onClick={() => setSettings({ theme: t.id as ThemeId })}
              aria-pressed={s.theme === t.id}
            >
              <span className="theme-swatch" aria-hidden="true">
                {t.swatch.map((c, i) => (
                  <span key={i} style={{ background: c }} />
                ))}
              </span>
              <span className="theme-name">
                {t.label}
                {s.theme === t.id && <span className="theme-check">✓</span>}
              </span>
              <span className="theme-hint">{t.hint}</span>
            </button>
          ))}
        </div>

        <div className="set-row">
          <div>
            <div className="set-row-title">Overview density</div>
            <div className="set-row-hint">Cards per row on a wide screen.</div>
          </div>
          <div className="seg-group">
            {([2, 3] as const).map((d) => (
              <button
                key={d}
                className={`seg ${s.density === d ? "active" : ""}`}
                onClick={() => setSettings({ density: d })}
              >
                {d} across
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- tabs ---------- */}
      <section className="set-block">
        <h3 className="set-h">Tabs</h3>
        <p className="set-sub">Reorder the nav, or hide tabs you don’t use. Overview always stays.</p>
        <OrderList
          items={s.tabOrder}
          hidden={s.hiddenTabs}
          label={(k) => TAB_LABEL[k]}
          locked={(k) => k === "overview"}
          onMove={(k, dir) => setSettings((cur) => ({ tabOrder: move(cur.tabOrder, k, dir) }))}
          onToggle={(k) => setSettings((cur) => ({ hiddenTabs: toggle(cur.hiddenTabs, k) }))}
        />
        <button
          className="btn small"
          onClick={() => setSettings({ tabOrder: [...ALL_TABS], hiddenTabs: [] })}
        >
          Reset tabs
        </button>
      </section>

      {/* ---------- widgets ---------- */}
      <section className="set-block">
        <h3 className="set-h">Overview widgets</h3>
        <p className="set-sub">
          Position and size are set by dragging on the board itself: open <b>Overview</b> →{" "}
          <b>Edit layout</b>, then drag cards where you want them, resize with S / M / L, and park
          the ones you don't need. Toggle them here if you prefer.
        </p>
        <ul className="order-list">
          {ALL_WIDGETS.map((k) => {
            const off = s.hiddenWidgets.includes(k);
            return (
              <li key={k} className={`order-row ${off ? "is-off" : ""}`}>
                <span className="order-main">
                  <span className="order-label">
                    {WIDGET_META[k].label}
                    <span className="order-badge">{SPAN_LABEL[s.widgetSpans[k] ?? 1]}</span>
                  </span>
                  <span className="order-hint">{WIDGET_META[k].hint}</span>
                </span>
                <button
                  className={`switch ${off ? "" : "on"}`}
                  onClick={() => setSettings((cur) => ({ hiddenWidgets: toggle(cur.hiddenWidgets, k) }))}
                  role="switch"
                  aria-checked={!off}
                  title={off ? "Show" : "Hide"}
                >
                  <span className="switch-knob" />
                </button>
              </li>
            );
          })}
        </ul>
        <button
          className="btn small"
          onClick={() => setSettings({ widgetOrder: [...ALL_WIDGETS], hiddenWidgets: [], widgetSpans: { ...DEFAULT_SPANS } })}
        >
          Reset widget layout
        </button>
      </section>

      <CalendarConnectionSettings />
      <CodexSection />
      <NotionSection />
      <AccountSection />

      <section className="set-block">
        <h3 className="set-h">Reset</h3>
        <p className="set-sub">Put theme, tabs, and widgets back to their defaults.</p>
        <button
          className="btn small"
          onClick={() => {
            if (confirm("Reset all appearance and layout settings?")) resetSettings();
          }}
        >
          Reset all settings
        </button>
      </section>
    </div>
  );
}

function CodexSection() {
  const [state, setState] = useState<{
    loading: boolean;
    connected: boolean;
    message: string;
    plan: string | null;
  }>({ loading: true, connected: false, message: "Checking your Codex connection…", plan: null });

  const check = useCallback(() => {
    setState((current) => ({ ...current, loading: true }));
    fetch(`/api/agent?t=${Date.now()}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((body) =>
        setState({
          loading: false,
          connected: Boolean(body.connected),
          message: String(body.message || "Codex is not connected."),
          plan: body.plan ? String(body.plan) : null,
        }),
      )
      .catch(() =>
        setState({ loading: false, connected: false, message: "Could not check Codex.", plan: null }),
      );
  }, []);

  useEffect(() => check(), [check]);

  return (
    <section className="set-block codex-connection">
      <div className="set-section-heading">
        <div>
          <h3 className="set-h">Codex</h3>
          <p className="set-sub">
            Command-K prompts and task planning use the Codex plan already signed in on your Mac.
          </p>
        </div>
        <span className={`connection-pill ${state.connected ? "connected" : ""}`}>
          <i /> {state.loading ? "Checking" : state.connected ? "Connected" : "Offline"}
        </span>
      </div>
      <div className="set-row">
        <div>
          <div className="set-row-title">
            {state.connected ? "Your Codex plan is connected" : "Local Codex connection"}
          </div>
          <div className="set-row-hint">{state.message}</div>
        </div>
        <button className="btn small" onClick={check} disabled={state.loading}>
          {state.loading ? "Checking…" : "Check connection"}
        </button>
      </div>
    </section>
  );
}

// ---------- reusable reorder list ----------
function OrderList<K extends TabKey | WidgetKey>({
  items,
  hidden,
  label,
  hint,
  badge,
  locked,
  onMove,
  onToggle,
}: {
  items: K[];
  hidden: K[];
  label: (k: K) => string;
  hint?: (k: K) => string;
  badge?: (k: K) => string | undefined;
  locked?: (k: K) => boolean;
  onMove: (k: K, dir: -1 | 1) => void;
  onToggle: (k: K) => void;
}) {
  return (
    <ul className="order-list">
      {items.map((k, i) => {
        const off = hidden.includes(k);
        const isLocked = locked?.(k) ?? false;
        return (
          <li key={k} className={`order-row ${off ? "is-off" : ""}`}>
            <span className="order-grip" aria-hidden="true">
              ⠿
            </span>
            <span className="order-main">
              <span className="order-label">
                {label(k)}
                {badge?.(k) && <span className="order-badge">{badge(k)}</span>}
              </span>
              {hint?.(k) && <span className="order-hint">{hint(k)}</span>}
            </span>
            <span className="order-actions">
              <button
                className="icon-btn"
                onClick={() => onMove(k, -1)}
                disabled={i === 0}
                title="Move up"
                aria-label={`Move ${label(k)} up`}
              >
                ↑
              </button>
              <button
                className="icon-btn"
                onClick={() => onMove(k, 1)}
                disabled={i === items.length - 1}
                title="Move down"
                aria-label={`Move ${label(k)} down`}
              >
                ↓
              </button>
              <button
                className={`switch ${off ? "" : "on"}`}
                onClick={() => !isLocked && onToggle(k)}
                disabled={isLocked}
                role="switch"
                aria-checked={!off}
                title={isLocked ? "Always visible" : off ? "Show" : "Hide"}
              >
                <span className="switch-knob" />
              </button>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// ---------- Notion ----------
function NotionSection() {
  const [creds, setCreds] = useState<Credentials>(EMPTY_CREDS);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [items, setItems] = useState<NotionItem[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<"" | "list" | "sync">("");
  const [err, setErr] = useState("");
  const [result, setResult] = useState("");

  useEffect(() => {
    const c = getCredentials();
    setCreds(c);
    setEditing(!c.notionToken);
  }, []);

  const save = useCallback(() => {
    const next = { ...creds, notionToken: draft.trim() };
    setCredentials(next);
    setCreds(next);
    setDraft("");
    setEditing(false);
    setItems(null);
  }, [creds, draft]);

  async function load() {
    setBusy("list");
    setErr("");
    setResult("");
    try {
      const r = await fetch("/api/notion/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: creds.notionToken }),
      });
      const b = (await r.json()) as { items?: NotionItem[]; error?: string };
      if (!r.ok) throw new Error(b.error || "Could not reach Notion.");
      setItems(b.items ?? []);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function sync() {
    const targets = (items ?? [])
      .filter((i) => picked.has(i.id))
      .map((i) => ({ id: i.id, type: i.type }));
    if (!targets.length) return;
    setBusy("sync");
    setErr("");
    setResult("");
    try {
      const r = await fetch("/api/notion/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: creds.notionToken, targets }),
      });
      const b = (await r.json()) as {
        count?: number;
        failed?: { id: string; error: string }[];
        error?: string;
      };
      if (!r.ok) throw new Error(b.error || "Sync failed.");
      const failed = b.failed?.length ?? 0;
      setResult(
        `Imported ${b.count} file${b.count === 1 ? "" : "s"} into sources/notion/${
          failed ? ` · ${failed} failed` : ""
        }. Run /ingest to compile them into the wiki.`,
      );
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="set-block">
      <h3 className="set-h">Notion import</h3>
      <p className="set-sub">
        Pull Notion pages into <code>sources/notion/</code> as markdown — the same idea as the
        Obsidian importer. They become normal wiki sources, so the next <code>/ingest</code>{" "}
        compiles them into pages.
      </p>

      <ol className="set-steps">
        <li>
          Create an internal integration at{" "}
          <a href="https://www.notion.so/my-integrations" target="_blank" rel="noreferrer">
            notion.so/my-integrations
          </a>{" "}
          and copy its secret.
        </li>
        <li>
          In Notion, open a page → <b>⋯ → Connections →</b> your integration. Only shared pages are
          visible.
        </li>
        <li>Paste the secret below, load your pages, and pick what to import.</li>
      </ol>

      <div className="cred-row">
        <div className="cred-main">
          <div className="set-row-title">Integration secret</div>
          {editing ? (
            <input
              className="set-input"
              type="password"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="ntn_… or secret_…"
              autoComplete="off"
              spellCheck={false}
            />
          ) : (
            <code className="cred-mask">{maskToken(creds.notionToken)}</code>
          )}
          <div className="set-row-hint">
            Stored in this browser’s localStorage and sent only to Notion via this app’s server.
            Never committed.
          </div>
        </div>
        <div className="cred-actions">
          {editing ? (
            <>
              <button className="btn small btn-primary" onClick={save} disabled={!draft.trim()}>
                Save
              </button>
              {creds.notionToken && (
                <button className="btn small" onClick={() => setEditing(false)}>
                  Cancel
                </button>
              )}
            </>
          ) : (
            <>
              <button
                className="btn small"
                onClick={() => {
                  setDraft("");
                  setEditing(true);
                }}
              >
                Replace
              </button>
              <button
                className="btn small"
                onClick={() => {
                  clearCredentials();
                  setCreds(EMPTY_CREDS);
                  setItems(null);
                  setEditing(true);
                }}
              >
                Clear
              </button>
            </>
          )}
        </div>
      </div>

      {creds.notionToken && !editing && (
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn small" onClick={load} disabled={busy !== ""}>
            {busy === "list" ? "Loading…" : items ? "Refresh list" : "Load my Notion pages"}
          </button>
          {items && items.length > 0 && (
            <button className="btn small btn-primary" onClick={sync} disabled={busy !== "" || picked.size === 0}>
              {busy === "sync" ? "Importing…" : `Import ${picked.size || ""} selected`}
            </button>
          )}
        </div>
      )}

      {err && <div className="banner" style={{ marginTop: 12 }}>{err}</div>}
      {result && <div className="set-ok">{result}</div>}

      {items && (
        <div className="notion-list">
          {items.length === 0 ? (
            <div className="empty">
              No pages shared with this integration yet — connect one in Notion, then refresh.
            </div>
          ) : (
            items.map((i) => (
              <label key={i.id} className="notion-row">
                <input
                  type="checkbox"
                  checked={picked.has(i.id)}
                  onChange={() =>
                    setPicked((p) => {
                      const n = new Set(p);
                      if (n.has(i.id)) n.delete(i.id);
                      else n.add(i.id);
                      return n;
                    })
                  }
                />
                <span className="notion-title">{i.title}</span>
                <span className={`notion-kind ${i.type}`}>{i.type}</span>
                <span className="notion-date">{i.edited}</span>
              </label>
            ))
          )}
        </div>
      )}
    </section>
  );
}

// ---------- account ----------
function AccountSection() {
  const [info, setInfo] = useState<{ enabled: boolean; google: boolean; password: boolean } | null>(
    null,
  );

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((b) => setInfo({ enabled: b.enabled, google: b.google, password: b.password }))
      .catch(() => setInfo({ enabled: false, google: false, password: false }));
  }, []);
  const enabled = info?.enabled ?? null;

  if (enabled === null) return null;

  return (
    <section className="set-block">
      <h3 className="set-h">Account</h3>
      {enabled ? (
        <>
          <p className="set-sub">
            You’re signed in to this deployment
            {info?.google && info?.password
              ? " (Google or password)."
              : info?.google
                ? " with Google."
                : "."}
          </p>
          <button className="btn small" onClick={() => logout()}>
            Sign out
          </button>
        </>
      ) : (
        <p className="set-sub">
          This deployment is open. Set <code>APP_PASSWORD</code> for a shared password, or
          <code>ALLOWED_EMAILS</code> + <code>AUTH_SECRET</code> (with the existing
          <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code>) for Google sign-in. Writes then need a valid
          session too.
        </p>
      )}
    </section>
  );
}
