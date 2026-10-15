"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { VaultData } from "@/lib/types";
import type { SearchResult } from "@/lib/search";
import { Overview } from "./Overview";
import dynamic from "next/dynamic";
import { CommandPalette } from "./CommandPalette";
import { useLiveVault } from "./LiveVault";
import { CortexMark } from "./CortexMark";
import { Icon } from "./Icon";
import { Dialog } from "./Dialog";
import { useMobileEditing } from "@/lib/useMobileEditing";
import { MOBILE_QUERY, useMobile } from "@/lib/useMobile";
import { useTaskWorkspace } from "@/lib/useTaskWorkspace";
import { TAB_LABEL, useSettings, type TabKey } from "@/lib/settings";
import { buildAgentContext } from "@/lib/agent-context";
import { estimateTaskDurations } from "@/lib/clientapi";

// Calendar pulls in the OAuth SDKs (MSAL + Google GIS) — load it only when the
// tab is opened so it stays out of the initial bundle.
const CalendarTab = dynamic(
  () => import("./CalendarTab").then((m) => m.CalendarTab),
  {
    ssr: false,
    loading: () => (
      <div className="muted" style={{ padding: 24 }}>
        Loading calendar…
      </div>
    ),
  },
);

// Persistent documents (Crepe editor) — lazy so its editor stays out of the
// initial bundle, same as the calendar.
const NotesTab = dynamic(() => import("./NotesTab").then((m) => m.NotesTab), {
  ssr: false,
  loading: () => (
    <div className="muted" style={{ padding: 24 }}>
      Loading documents…
    </div>
  ),
});

// Settings is rarely the first thing opened — keep it out of the initial bundle.
const SettingsTab = dynamic(
  () => import("./SettingsTab").then((m) => m.SettingsTab),
  {
    ssr: false,
    loading: () => (
      <div className="muted" style={{ padding: 24 }}>
        Loading settings…
      </div>
    ),
  },
);

// Heavy editors and markdown renderers are loaded only when their view opens.
const TodayTab = dynamic(() => import("./TodayTab").then((m) => m.TodayTab), {
  loading: WorkspaceLoading,
});
const WikiTab = dynamic(() => import("./WikiTab").then((m) => m.WikiTab), {
  loading: WorkspaceLoading,
});
const AgentTab = dynamic(() => import("./AgentTab").then((m) => m.AgentTab), {
  loading: WorkspaceLoading,
});
const TasksTab = dynamic(() => import("./TasksTab").then((m) => m.TasksTab), {
  loading: WorkspaceLoading,
});
const DailyTab = dynamic(() => import("./DailyTab").then((m) => m.DailyTab), {
  loading: WorkspaceLoading,
});
const LogTab = dynamic(() => import("./LogTab").then((m) => m.LogTab), {
  loading: WorkspaceLoading,
});
function WorkspaceLoading() {
  return (
    <div className="workspace-loading" role="status">
      <div />
      <div />
      <div />
      <span>Opening your workspace…</span>
    </div>
  );
}

type Tab = TabKey | "settings";
type Focus = { id: string; n: number } | null;

export function Dashboard({ data }: { data: VaultData }) {
  // Prefer the live Convex mirror when configured; fall back to build-time data.
  const live = useLiveVault();
  // Prefer whichever snapshot reflects newer repo state: the Convex live mirror
  // when its last sync is newer than this build, else the build-time data. Keeps
  // the app fresh even if the mirror lags (infrequent cron) or is disabled.
  const vault =
    live && (live.builtAt ?? "") > (data.builtAt ?? "") ? live : data;
  const settings = useSettings();
  const workspace = useTaskWorkspace(vault.tasks);
  const workspaceVault = useMemo(
    () => ({ ...vault, tasks: workspace.tasks }),
    [vault, workspace.tasks],
  );
  const [tab, setTabState] = useState<Tab>("overview");
  const [ready, setReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const mobile = useMobile();
  const mobileEditing = useMobileEditing(mobile);
  const setTab = useCallback((next: Tab) => {
    setTabState(next);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);
  useEffect(() => {
    if (window.matchMedia(MOBILE_QUERY).matches) setTabState("today");
    setReady(true);
  }, []);
  const [wikiSlug, setWikiSlug] = useState<string | null>(null);
  const [dailyFocus, setDailyFocus] = useState<Focus>(null);
  const [taskFocus, setTaskFocus] = useState<Focus>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [timeboxRequest, setTimeboxRequest] = useState(0);
  const nav = useRef(0);

  // The visible nav, in the user's order (Settings → Tabs).
  const tabs = useMemo(
    () => settings.tabOrder.filter((t) => !settings.hiddenTabs.includes(t)),
    [settings.tabOrder, settings.hiddenTabs],
  );

  // If the open tab gets hidden from the nav, fall back to Overview.
  useEffect(() => {
    if (
      tab !== "settings" &&
      !(mobile && tab === "today") &&
      !tabs.includes(tab as TabKey)
    )
      setTab("overview");
  }, [tabs, tab, mobile, setTab]);

  const openWiki = useCallback((slug: string) => {
    setWikiSlug(slug);
    setTab("wiki");
  }, []);
  const openDaily = useCallback((stem: string) => {
    setDailyFocus({ id: stem, n: ++nav.current });
    setTab("daily");
  }, []);
  const openTask = useCallback((id: string) => {
    setTaskFocus({ id, n: ++nav.current });
    setTab("tasks");
  }, []);

  // ⌘K / Ctrl+K opens search from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onSelect = useCallback(
    (r: SearchResult) => {
      if (r.kind === "wiki") openWiki(r.id);
      else if (r.kind === "daily") openDaily(r.id);
      else openTask(r.id);
    },
    [openWiki, openDaily, openTask],
  );
  const onAskAgent = useCallback(async (prompt: string) => {
    const response = await fetch("/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt,
        context: buildAgentContext(prompt, workspaceVault),
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Could not reach Codex.");
    return String(body.response || "Codex accepted your prompt.");
  }, [workspaceVault]);

  if (!ready) return <WorkspaceLoading />;

  return (
    <div className={`workspace-shell view-${tab}${mobile ? " is-mobile" : ""}${mobileEditing.editing ? " is-editing" : ""}`} style={mobileEditing.editing ? { "--editing-viewport-height": `${mobileEditing.height}px` } as CSSProperties : undefined}>
      <a className="skip-link" href="#workspace-main">
        Skip to content
      </a>
      <aside className="workspace-sidebar">
        <button
          className="workspace-brand"
          onClick={() => setTab("overview")}
          aria-label="Cortex home"
        >
          <CortexMark />
          <span>Cortex</span>
        </button>
        <button
          className="workspace-search-launch"
          onClick={() => setPaletteOpen(true)}
        >
          <Icon name="search" size={16} />
          <span>Find anything</span>
          <kbd>⌘ K</kbd>
        </button>
        <div className="nav-caption">Workspace</div>
        <nav className="workspace-nav" aria-label="Main navigation">
          {tabs.map((t) => (
            <button
              key={t}
              className={`workspace-nav-item ${tab === t ? "active" : ""}`}
              aria-current={tab === t ? "page" : undefined}
              onClick={() => setTab(t)}
            >
              <Icon name={t} />
              <span>{TAB_LABEL[t]}</span>
              {t === "tasks" && (
                <small>
                  {
                    workspace.tasks.filter((task) => task.status !== "done")
                      .length
                  }
                </small>
              )}
              {t === "wiki" && <small>{vault.wiki.length}</small>}
            </button>
          ))}
        </nav>
        <div className="workspace-sidebar-bottom">
          <button
            className={`workspace-nav-item ${tab === "settings" ? "active" : ""}`}
            aria-current={tab === "settings" ? "page" : undefined}
            onClick={() => setTab("settings")}
          >
            <Icon name="settings" />
            <span>Settings</span>
          </button>
        </div>
      </aside>
      <div className="workspace-main-wrap">
        {mobile && (
          <header className="workspace-topbar">
            <div id="workspace-phone-actions" />
            <h1 className="workspace-phone-title">{tab === "settings" ? "Settings" : TAB_LABEL[tab]}</h1>
          </header>
        )}
        {mobile && !paletteOpen && (
          <button className="workspace-search-bubble" aria-label="Search workspace" onClick={() => setPaletteOpen(true)}>
            <Icon name="search" size={22} />
          </button>
        )}
        <main id="workspace-main" tabIndex={-1} className="workspace-main">
          <div className="workspace-view" key={tab}>
            {tab === "overview" && (
              <div className="page-heading">
                <h1>Overview</h1>
                <button
                  className="btn btn-primary"
                  onClick={() => setTab("today")}
                >
                  <Icon name="plus" />
                  Today’s notes
                </button>
              </div>
            )}
            {tab === "overview" && (
              <Overview
                data={workspaceVault}
                onTab={setTab}
                openDaily={openDaily}
              />
            )}
            {tab === "today" && (
              <TodayTab
                compact={mobile}
                workspace={workspace}
                openTask={openTask}
                openTasks={() => setTab("tasks")}
                openCalendar={() => setTab("calendar")}
              />
            )}
            {tab === "daily" && (
              <DailyTab
                notes={vault.daily}
                focus={dailyFocus}
                compact={mobile}
              />
            )}
            {tab === "docs" && <NotesTab />}
            {tab === "calendar" && (
              <CalendarTab
                planned={vault.planned ?? data.planned ?? []}
                tasks={workspace.tasks}
                timeboxRequest={timeboxRequest}
                estimateTasks={async () => {
                  const { estimates } = await estimateTaskDurations(workspace.tasks);
                  return Object.fromEntries(estimates.map((item) => [item.taskId, item.minutes]));
                }}
                openTask={openTask}
                rescheduleTask={async (id, due) => {
                  const task = workspace.tasks.find((item) => item.id === id);
                  if (task) await workspace.save(task, { due_date: due });
                }}
                saveTimeboxes={async (timeboxes) => {
                  await Promise.all(
                    timeboxes.map(async (timebox) => {
                      const task = workspace.tasks.find(
                        (item) => item.id === timebox.taskId,
                      );
                      if (task)
                        await workspace.save(task, {
                          estimate_minutes: timebox.minutes,
                          timebox_start: timebox.start,
                          ...(!task.due_date && timebox.dueDate ? { due_date: timebox.dueDate } : {}),
                        });
                    }),
                  );
                }}
              />
            )}
            {tab === "wiki" && (
              <WikiTab
                pages={vault.wiki}
                slug={wikiSlug}
                setSlug={setWikiSlug}
                compact={mobile}
              />
            )}
            {tab === "agent" && <AgentTab data={workspaceVault} openWiki={openWiki} />}
            {tab === "tasks" && (
              <TasksTab
                compact={mobile}
                workspace={workspace}
                openWiki={openWiki}
                openCalendar={() => setTab("calendar")}
                onAgentTimebox={() => {
                  setTimeboxRequest((request) => request + 1);
                  setTab("calendar");
                }}
                focus={taskFocus}
              />
            )}
            {tab === "log" && (
              <LogTab
                entries={vault.log}
                changes={data.changelog ?? []}
                openTask={openTask}
                openDaily={openDaily}
              />
            )}
            {tab === "settings" && <SettingsTab />}
          </div>
        </main>
      </div>
      {mobile && (
        <nav className="native-tabbar" aria-label="Tab bar">
          {(["today", "calendar", "tasks", "agent"] as TabKey[])
            .filter((item) => item === "today" || tabs.includes(item))
            .map((item) => (
              <button
                key={item}
                aria-current={tab === item ? "page" : undefined}
                onClick={() => setTab(item)}
              >
                <Icon name={item} size={23} />
                <span>{TAB_LABEL[item]}</span>
              </button>
            ))}
          <button
            aria-label="More"
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
            aria-current={!["today", "calendar", "tasks", "agent"].includes(tab) ? "page" : undefined}
            onClick={() => setMenuOpen(true)}
          >
            <Icon name="more" size={23} />
            <span>More</span>
          </button>
        </nav>
      )}
      {menuOpen && (
        <Dialog
          label="Navigate workspace"
          className="mobile-navigation"
          onClose={() => setMenuOpen(false)}
        >
          <div className="mobile-navigation-heading">
            <div>
              <span className="eyebrow">Cortex</span>
              <h2>Your workspace</h2>
            </div>
            <button
              className="icon-button"
              aria-label="Close navigation"
              onClick={() => setMenuOpen(false)}
            >
              <Icon name="close" />
            </button>
          </div>
          <nav aria-label="Mobile navigation">
            {(
              [
                "today",
                ...tabs.filter((t) => t !== "today"),
                "settings",
              ] as Tab[]
            ).map((t) => (
              <button
                key={t}
                aria-current={tab === t ? "page" : undefined}
                onClick={() => setTab(t)}
              >
                <Icon name={t} />
                <span>{t === "settings" ? "Settings" : TAB_LABEL[t]}</span>
                <Icon name="chevron" size={16} />
              </button>
            ))}
          </nav>

        </Dialog>
      )}
      <CommandPalette
        data={workspaceVault}
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelect={onSelect}
        onAskAgent={onAskAgent}
        onTimeboxTasks={() => {
          setTimeboxRequest((request) => request + 1);
          setTab("calendar");
        }}
      />
    </div>
  );
}
