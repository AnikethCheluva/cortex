"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VaultData } from "@/lib/types";
import type { SearchResult } from "@/lib/search";
import { Overview } from "./Overview";
import { TodayTab } from "./TodayTab";
import { WikiTab } from "./WikiTab";
import { TasksTab } from "./TasksTab";
import { DailyTab } from "./DailyTab";
import { LogTab } from "./LogTab";
import dynamic from "next/dynamic";
import { CommandPalette } from "./CommandPalette";
import { useLiveVault } from "./LiveVault";

// Calendar pulls in the OAuth SDKs (MSAL + Google GIS) — load it only when the
// tab is opened so it stays out of the initial bundle.
const CalendarTab = dynamic(() => import("./CalendarTab").then((m) => m.CalendarTab), {
  ssr: false,
  loading: () => <div className="muted" style={{ padding: 24 }}>Loading calendar…</div>,
});

// Persistent documents (Crepe editor) — lazy so its editor stays out of the
// initial bundle, same as the calendar.
const NotesTab = dynamic(() => import("./NotesTab").then((m) => m.NotesTab), {
  ssr: false,
  loading: () => <div className="muted" style={{ padding: 24 }}>Loading documents…</div>,
});

type Tab = "overview" | "today" | "daily" | "docs" | "calendar" | "wiki" | "tasks" | "log";
type Focus = { id: string; n: number } | null;

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "today", label: "Today" },
  { key: "daily", label: "Daily" },
  { key: "docs", label: "Docs" },
  { key: "calendar", label: "Calendar" },
  { key: "wiki", label: "Wiki" },
  { key: "tasks", label: "Tasks" },
  { key: "log", label: "Activity" },
];

export function Dashboard({ data }: { data: VaultData }) {
  // Prefer the live Convex mirror when configured; fall back to build-time data.
  const live = useLiveVault();
  // Prefer whichever snapshot reflects newer repo state: the Convex live mirror
  // when its last sync is newer than this build, else the build-time data. Keeps
  // the app fresh even if the mirror lags (infrequent cron) or is disabled.
  const vault = live && (live.builtAt ?? "") > (data.builtAt ?? "") ? live : data;
  const [tab, setTab] = useState<Tab>("overview");
  const [wikiSlug, setWikiSlug] = useState<string | null>(null);
  const [dailyFocus, setDailyFocus] = useState<Focus>(null);
  const [taskFocus, setTaskFocus] = useState<Focus>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const nav = useRef(0);

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

  return (
    <div className="wrap">
      <header className="app-header">
        <div className="app-title">Cortex</div>
        <div className="app-user">
          <button className="search-btn" onClick={() => setPaletteOpen(true)}>
            <span>Search</span>
            <kbd>⌘K</kbd>
          </button>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab ${tab === t.key ? "active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <Overview data={vault} onTab={setTab} openDaily={openDaily} />
      )}
      {tab === "today" && <TodayTab />}
      {tab === "daily" && <DailyTab notes={vault.daily} focus={dailyFocus} />}
      {tab === "docs" && <NotesTab />}
      {tab === "calendar" && <CalendarTab planned={data.planned ?? []} />}
      {tab === "wiki" && (
        <WikiTab pages={vault.wiki} slug={wikiSlug} setSlug={setWikiSlug} />
      )}
      {tab === "tasks" && (
        <TasksTab tasks={vault.tasks} openWiki={openWiki} focus={taskFocus} />
      )}
      {tab === "log" && <LogTab entries={vault.log} />}

      <CommandPalette
        data={vault}
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelect={onSelect}
      />
    </div>
  );
}
