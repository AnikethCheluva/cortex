"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  anyConfigured,
  connections,
  createEvent,
  deleteEvent,
  listEvents,
  providerConfigured,
  signIn,
  signOut,
  PROVIDER_LABEL,
  type CalEvent,
  type CalProvider,
} from "@/lib/calendar";
import { plannedToEvents } from "@/lib/calendar/planned";
import type { PlannedEvent } from "@/lib/types";

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const sameYmd = (a: Date, b: Date) => ymd(a) === ymd(b);

// The event's local calendar-day key (all-day events keep their date verbatim).
const dayKey = (e: CalEvent) => (e.allDay ? e.start.slice(0, 10) : ymd(new Date(e.start)));
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const MONTHS = "January February March April May June July August September October November December".split(" ");
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function monthGrid(cursor: Date): Date[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay()); // back up to Sunday
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

// The seven days (Sun–Sat) of the week containing `cursor`.
function weekOf(cursor: Date): Date[] {
  const start = new Date(cursor);
  start.setHours(0, 0, 0, 0);
  start.setDate(cursor.getDate() - cursor.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function weekLabel(days: Date[]): string {
  const a = days[0];
  const b = days[6];
  const mo = (d: Date) => MONTHS[d.getMonth()].slice(0, 3);
  const right = a.getMonth() === b.getMonth() ? `${b.getDate()}` : `${mo(b)} ${b.getDate()}`;
  return `${mo(a)} ${a.getDate()} – ${right}, ${b.getFullYear()}`;
}

const HOUR_PX = 44; // vertical scale of the week time-grid
const fmtHour = (h: number) =>
  h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`;

const PROVIDER_COLOR: Record<CalProvider, string> = {
  google: "var(--info)",
  microsoft: "var(--claude)",
  planned: "var(--accent)", // brass — the agent's own suggestions
};

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

// Track a max-width media query so we can render the phone layout on small
// screens (SSR-safe: starts false, resolves on mount).
function useIsMobile(breakpoint = 720): boolean {
  const [mobile, setMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(`(max-width: ${breakpoint}px)`).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [breakpoint]);
  return mobile;
}

export function CalendarTab({ planned = [] }: { planned?: PlannedEvent[] }) {
  const [cursor, setCursor] = useState(() => new Date());
  const [view, setView] = useState<"day" | "week" | "month" | "agenda">("week");
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [conn, setConn] = useState<Record<CalProvider, boolean>>({
    google: false,
    microsoft: false,
    planned: false,
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [selDay, setSelDay] = useState<string | null>(null);
  const [detail, setDetail] = useState<CalEvent | null>(null);
  const [composing, setComposing] = useState(false);
  const [showPlanned, setShowPlanned] = useState(true);
  const nav = useRef(0);
  const isMobile = useIsMobile();

  const grid = useMemo(() => monthGrid(cursor), [cursor]);
  const weekDays = useMemo(() => weekOf(cursor), [cursor]);
  const dayCol = useMemo(() => {
    const d = new Date(cursor);
    d.setHours(0, 0, 0, 0);
    return [d];
  }, [cursor]);
  const range = useMemo(() => {
    // On mobile we always load the whole week so tapping strip days is instant.
    const span = isMobile || view === "week" ? weekDays : view === "day" ? dayCol : grid;
    const s = new Date(span[0]);
    s.setHours(0, 0, 0, 0);
    const e = new Date(span[span.length - 1]);
    e.setHours(23, 59, 59, 0);
    return { startISO: s.toISOString(), endISO: e.toISOString() };
  }, [isMobile, view, grid, weekDays, dayCol]);

  // Agent-planned deliverables (git-backed) overlaid on the fetched events.
  const plannedEvents = useMemo(
    () => (showPlanned ? plannedToEvents(planned, range.startISO, range.endISO) : []),
    [planned, showPlanned, range.startISO, range.endISO],
  );
  const allEvents = useMemo(
    () => [...events, ...plannedEvents].sort((a, b) => a.start.localeCompare(b.start)),
    [events, plannedEvents],
  );
  const byDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    for (const e of allEvents) (m.get(dayKey(e)) ?? m.set(dayKey(e), []).get(dayKey(e))!).push(e);
    return m;
  }, [allEvents]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      setConn(await connections());
      setEvents(await listEvents(range.startISO, range.endISO));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [range.startISO, range.endISO]);

  useEffect(() => {
    const n = ++nav.current;
    refresh().then(() => n === nav.current || undefined);
  }, [refresh]);

  async function connect(p: CalProvider) {
    setErr("");
    try {
      await signIn(p);
      await refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  async function disconnect(p: CalProvider) {
    await signOut(p).catch(() => {});
    await refresh();
  }
  async function remove(ev: CalEvent) {
    try {
      await deleteEvent(ev);
      setDetail(null);
      await refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  // Planned-overlay visibility persists per browser.
  useEffect(() => {
    setShowPlanned(localStorage.getItem("cal_show_planned") !== "0");
  }, []);
  const togglePlanned = () =>
    setShowPlanned((v) => {
      localStorage.setItem("cal_show_planned", v ? "0" : "1");
      return !v;
    });

  const today = new Date();
  const anyConn = conn.google || conn.microsoft;

  // Prev/next steps by a day/week in those views, otherwise by a month.
  const step = (dir: number) =>
    setCursor((c) =>
      view === "day"
        ? new Date(c.getFullYear(), c.getMonth(), c.getDate() + dir)
        : view === "week"
          ? new Date(c.getFullYear(), c.getMonth(), c.getDate() + dir * 7)
          : new Date(c.getFullYear(), c.getMonth() + dir, 1),
    );
  const headerLabel =
    view === "day"
      ? cursor.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })
      : view === "week"
        ? weekLabel(weekDays)
        : `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;

  if (!anyConfigured()) {
    return (
      <div>
        <h2 className="section">Calendar</h2>
        <div className="cal-setup">
          <div className="cal-setup-h">Connect your calendars</div>
          <p className="muted">
            Set <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> and/or <code>NEXT_PUBLIC_MS_CLIENT_ID</code> in
            Vercel (see <code>web/CALENDAR.md</code>) to enable Google Calendar and Outlook. Auth is
            client-side — no secrets stored.
          </p>
        </div>
      </div>
    );
  }

  // ---- phone layout: Notion-style day grid + tappable week strip ----
  if (isMobile) {
    return (
      <div className="cal-mobile">
        <div className="cal-m-top">
          <div className="cal-m-title">
            <span className="cal-m-day">{cursor.toLocaleDateString([], { weekday: "long" })}</span>
            <span className="cal-m-date">
              {MONTHS[cursor.getMonth()]} {cursor.getDate()}
            </span>
          </div>
          <div className="cal-m-actions">
            {planned.length > 0 && (
              <button
                className={`btn small cal-plan-btn ${showPlanned ? "on" : ""}`}
                onClick={togglePlanned}
                title="Toggle planned deliverables"
              >
                <span className="cal-dot" style={{ background: PROVIDER_COLOR.planned }} /> Plan
              </button>
            )}
            <button className="btn small" onClick={() => setCursor(new Date())}>
              Today
            </button>
            {anyConn && (
              <button className="btn btn-primary small" onClick={() => setComposing(true)}>
                +
              </button>
            )}
          </div>
        </div>

        <div className="cal-m-strip-row">
          <button className="icon-nav" onClick={() => setCursor((c) => addDays(c, -7))}>
            ‹
          </button>
          <WeekStrip days={weekDays} cursor={cursor} today={today} onPick={setCursor} />
          <button className="icon-nav" onClick={() => setCursor((c) => addDays(c, 7))}>
            ›
          </button>
        </div>

        {err && <div className="banner">{err}</div>}

        {!anyConn ? (
          <div className="cal-m-cals">
            <div className="cal-side-h">Connect a calendar</div>
            {(["google", "microsoft"] as CalProvider[]).map((p) =>
              providerConfigured(p) ? (
                <button
                  key={p}
                  className={`cal-cal-row ${conn[p] ? "on" : ""}`}
                  onClick={() => (conn[p] ? disconnect(p) : connect(p))}
                >
                  <span className="cal-dot" style={{ background: PROVIDER_COLOR[p] }} />
                  <span className="cal-cal-name">{PROVIDER_LABEL[p]}</span>
                  <span className="cal-cal-state">{conn[p] ? "on" : "connect"}</span>
                </button>
              ) : null,
            )}
          </div>
        ) : (
          <WeekView days={dayCol} byDay={byDay} today={today} onPick={setDetail} />
        )}

        {detail && (
          <EventDetail ev={detail} onClose={() => setDetail(null)} onDelete={() => remove(detail)} />
        )}
        {composing && (
          <Compose
            conn={conn}
            day={ymd(cursor)}
            onClose={() => setComposing(false)}
            onCreated={async () => {
              setComposing(false);
              await refresh();
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="cal-notion">
      <aside className="cal-side">
        <button className="cal-today-btn" onClick={() => setCursor(new Date())}>
          Today
        </button>
        <MiniMonth cursor={cursor} today={today} onPick={setCursor} />
        <div className="cal-side-cals">
          <div className="cal-side-h">Calendars</div>
          {(["google", "microsoft"] as CalProvider[]).map((p) =>
            providerConfigured(p) ? (
              <button
                key={p}
                className={`cal-cal-row ${conn[p] ? "on" : ""}`}
                onClick={() => (conn[p] ? disconnect(p) : connect(p))}
                title={conn[p] ? `Disconnect ${PROVIDER_LABEL[p]}` : `Connect ${PROVIDER_LABEL[p]}`}
              >
                <span className="cal-dot" style={{ background: PROVIDER_COLOR[p] }} />
                <span className="cal-cal-name">{PROVIDER_LABEL[p]}</span>
                <span className="cal-cal-state">{conn[p] ? "on" : "connect"}</span>
              </button>
            ) : null,
          )}
          {planned.length > 0 && (
            <button
              className={`cal-cal-row ${showPlanned ? "on" : ""}`}
              onClick={togglePlanned}
              title={showPlanned ? "Hide planned deliverables" : "Show planned deliverables"}
            >
              <span className="cal-dot" style={{ background: PROVIDER_COLOR.planned }} />
              <span className="cal-cal-name">Planned</span>
              <span className="cal-cal-state">{showPlanned ? "shown" : "hidden"}</span>
            </button>
          )}
        </div>
      </aside>

      <main className="cal-main">
        <div className="cal-topbar">
          <div className="cal-topbar-l">
            <span className="cal-range">{headerLabel}</span>
            {loading && <span className="muted cal-sync">syncing…</span>}
          </div>
          <div className="cal-topbar-r">
            <div className="cal-navgrp">
              <button className="icon-nav" onClick={() => step(-1)}>
                ‹
              </button>
              <button className="icon-nav" onClick={() => step(1)}>
                ›
              </button>
            </div>
            <div className="seg">
              {(["day", "week", "month", "agenda"] as const).map((v) => (
                <button
                  key={v}
                  className={`seg-btn ${view === v ? "active" : ""}`}
                  onClick={() => setView(v)}
                >
                  {v[0].toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
            {anyConn && (
              <button className="btn btn-primary small" onClick={() => setComposing(true)}>
                + Event
              </button>
            )}
          </div>
        </div>

        {err && <div className="banner">{err}</div>}

        {!anyConn && (
          <div className="empty">Connect a calendar in the sidebar to see your events.</div>
        )}

      {anyConn && view === "month" && (
        <div className="cal-month">
          <div className="cal-dow">
            {DOW.map((d) => (
              <div key={d} className="cal-dow-cell">
                {d}
              </div>
            ))}
          </div>
          <div className="cal-grid">
            {grid.map((d) => {
              const key = ymd(d);
              const evs = byDay.get(key) ?? [];
              const inMonth = d.getMonth() === cursor.getMonth();
              return (
                <button
                  key={key}
                  className={`cal-cell ${inMonth ? "" : "dim"} ${sameYmd(d, today) ? "today" : ""} ${selDay === key ? "sel" : ""}`}
                  onClick={() => setSelDay(selDay === key ? null : key)}
                >
                  <span className="cal-daynum">{d.getDate()}</span>
                  <span className="cal-evs">
                    {evs.slice(0, 3).map((e) => (
                      <span
                        key={e.id}
                        className={`cal-ev${e.provider === "planned" ? " planned" : ""}`}
                        onClick={(ce) => {
                          ce.stopPropagation();
                          setDetail(e);
                        }}
                      >
                        <span className="cal-dot" style={{ background: PROVIDER_COLOR[e.provider] }} />
                        {!e.allDay && <span className="cal-ev-t">{fmtTime(e.start)}</span>} {e.title}
                      </span>
                    ))}
                    {evs.length > 3 && <span className="cal-more">+{evs.length - 3} more</span>}
                  </span>
                </button>
              );
            })}
          </div>
          {selDay && (
            <DayList
              day={selDay}
              events={byDay.get(selDay) ?? []}
              onPick={setDetail}
              onClose={() => setSelDay(null)}
            />
          )}
        </div>
      )}

      {anyConn && (view === "day" || view === "week") && (
        <WeekView
          days={view === "day" ? dayCol : weekDays}
          byDay={byDay}
          today={today}
          onPick={setDetail}
        />
      )}

      {anyConn && view === "agenda" && <Agenda events={allEvents} onPick={setDetail} />}
      </main>

      {detail && <EventDetail ev={detail} onClose={() => setDetail(null)} onDelete={() => remove(detail)} />}
      {composing && (
        <Compose
          conn={conn}
          day={selDay}
          onClose={() => setComposing(false)}
          onCreated={async () => {
            setComposing(false);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

function DayList({
  day,
  events,
  onPick,
  onClose,
}: {
  day: string;
  events: CalEvent[];
  onPick: (e: CalEvent) => void;
  onClose: () => void;
}) {
  const label = new Date(day + "T12:00:00").toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  return (
    <div className="cal-daylist">
      <div className="cal-daylist-h">
        <span>{label}</span>
        <button className="inline-link" onClick={onClose}>
          close
        </button>
      </div>
      {events.length === 0 ? (
        <div className="muted">No events.</div>
      ) : (
        events.map((e) => (
          <button key={e.id} className="cal-row" onClick={() => onPick(e)}>
            <span className="cal-dot" style={{ background: PROVIDER_COLOR[e.provider] }} />
            <span className="cal-row-t">{e.allDay ? "all day" : `${fmtTime(e.start)}–${fmtTime(e.end)}`}</span>
            <span className="cal-row-title">{e.title}</span>
          </button>
        ))
      )}
    </div>
  );
}

function Agenda({ events, onPick }: { events: CalEvent[]; onPick: (e: CalEvent) => void }) {
  const now = new Date();
  const upcoming = events.filter((e) => new Date(e.allDay ? e.start + "T23:59" : e.end) >= now);
  const groups = new Map<string, CalEvent[]>();
  for (const e of upcoming) (groups.get(dayKey(e)) ?? groups.set(dayKey(e), []).get(dayKey(e))!).push(e);
  if (upcoming.length === 0) return <div className="empty">Nothing coming up in this range.</div>;
  return (
    <div className="cal-agenda">
      {[...groups.entries()].map(([day, evs]) => (
        <div key={day} className="cal-agenda-day">
          <div className="cal-agenda-date">
            {new Date(day + "T12:00:00").toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
          </div>
          <div className="cal-agenda-evs">
            {evs.map((e) => (
              <button key={e.id} className="cal-row" onClick={() => onPick(e)}>
                <span className="cal-dot" style={{ background: PROVIDER_COLOR[e.provider] }} />
                <span className="cal-row-t">{e.allDay ? "all day" : fmtTime(e.start)}</span>
                <span className="cal-row-title">{e.title}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Compact month navigator in the sidebar — click a day to move the main view.
// Keeps its own browsing month so you can look ahead without moving the view.
function MiniMonth({
  cursor,
  today,
  onPick,
}: {
  cursor: Date;
  today: Date;
  onPick: (d: Date) => void;
}) {
  const [mm, setMm] = useState(() => new Date(cursor.getFullYear(), cursor.getMonth(), 1));
  useEffect(() => {
    setMm(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
  }, [cursor]);
  return (
    <div className="cal-mini">
      <div className="cal-mini-h">
        <span className="cal-mini-title">
          {MONTHS[mm.getMonth()].slice(0, 3)} {mm.getFullYear()}
        </span>
        <span className="cal-mini-nav">
          <button className="icon-nav" onClick={() => setMm(new Date(mm.getFullYear(), mm.getMonth() - 1, 1))}>
            ‹
          </button>
          <button className="icon-nav" onClick={() => setMm(new Date(mm.getFullYear(), mm.getMonth() + 1, 1))}>
            ›
          </button>
        </span>
      </div>
      <div className="cal-mini-dow">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="cal-mini-grid">
        {monthGrid(mm).map((d) => (
          <button
            key={ymd(d)}
            className={`cal-mini-cell${d.getMonth() === mm.getMonth() ? "" : " dim"}${
              sameYmd(d, today) ? " today" : ""
            }${sameYmd(d, cursor) ? " sel" : ""}`}
            onClick={() => onPick(new Date(d))}
          >
            {d.getDate()}
          </button>
        ))}
      </div>
    </div>
  );
}

// Positioned timed-event block within a day column (px offsets + overlap lane).
type Placed = { e: CalEvent; top: number; height: number; lane: number; lanes: number };

// Lay out one day's timed events: clamp each to the day, then split overlapping
// clusters into side-by-side lanes so concurrent events sit next to each other.
function layoutDay(events: CalEvent[], day: Date): Placed[] {
  const base = new Date(`${ymd(day)}T00:00:00`).getTime();
  const items = events
    .map((e) => {
      const startMin = Math.max(0, (new Date(e.start).getTime() - base) / 60000);
      let endMin = Math.min(1440, (new Date(e.end).getTime() - base) / 60000);
      if (!(endMin > startMin)) endMin = startMin + 30; // ensure a visible block
      return { e, startMin, endMin };
    })
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  const out: Placed[] = [];
  let cluster: typeof items = [];
  let clusterEnd = -1;
  const flush = () => {
    const laneEnds: number[] = [];
    const laneOf = new Map<(typeof cluster)[number], number>();
    for (const it of cluster) {
      let lane = laneEnds.findIndex((end) => end <= it.startMin);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = it.endMin;
      laneOf.set(it, lane);
    }
    const lanes = laneEnds.length;
    for (const it of cluster) {
      out.push({
        e: it.e,
        top: (it.startMin / 60) * HOUR_PX,
        height: Math.max(((it.endMin - it.startMin) / 60) * HOUR_PX, 16),
        lane: laneOf.get(it) ?? 0,
        lanes,
      });
    }
    cluster = [];
  };
  for (const it of items) {
    if (cluster.length && it.startMin >= clusterEnd) flush();
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.endMin);
  }
  if (cluster.length) flush();
  return out;
}

// Horizontal week-day selector for the phone layout — tap a day to select it.
function WeekStrip({
  days,
  cursor,
  today,
  onPick,
}: {
  days: Date[];
  cursor: Date;
  today: Date;
  onPick: (d: Date) => void;
}) {
  return (
    <div className="cal-strip">
      {days.map((d) => (
        <button
          key={ymd(d)}
          className={`cal-strip-day${sameYmd(d, cursor) ? " sel" : ""}${
            sameYmd(d, today) ? " today" : ""
          }`}
          onClick={() => onPick(new Date(d))}
        >
          <span className="cal-strip-dow">{DOW[d.getDay()][0]}</span>
          <span className="cal-strip-dn">{d.getDate()}</span>
        </button>
      ))}
    </div>
  );
}

function WeekView({
  days,
  byDay,
  today,
  onPick,
}: {
  days: Date[];
  byDay: Map<string, CalEvent[]>;
  today: Date;
  onPick: (e: CalEvent) => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 7 * HOUR_PX - 8; // open near 7am
  }, []);
  const now = new Date();
  const nowTop = ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_PX;
  const hasAllDay = days.some((d) => (byDay.get(ymd(d)) ?? []).some((e) => e.allDay));
  const cols = `56px repeat(${days.length}, 1fr)`;

  return (
    <div className="cal-week">
      <div className="cal-week-grid" style={{ minWidth: days.length > 1 ? 660 : undefined }}>
        <div className="cal-week-head" style={{ gridTemplateColumns: cols }}>
          <div className="cal-week-gutter" />
          {days.map((d) => (
            <div key={ymd(d)} className={`cal-week-dh ${sameYmd(d, today) ? "today" : ""}`}>
              <span className="cal-week-dow">{DOW[d.getDay()]}</span>
              <span className="cal-week-dn">{d.getDate()}</span>
            </div>
          ))}
        </div>

        {hasAllDay && (
          <div className="cal-week-allday" style={{ gridTemplateColumns: cols }}>
            <div className="cal-week-gutter">all-day</div>
            {days.map((d) => (
              <div key={ymd(d)} className="cal-week-ad-col">
                {(byDay.get(ymd(d)) ?? [])
                  .filter((e) => e.allDay)
                  .map((e) => (
                    <button
                      key={e.id}
                      className={`cal-week-ad-ev${e.provider === "planned" ? " planned" : ""}`}
                      style={{ "--ev": PROVIDER_COLOR[e.provider] } as CSSProperties}
                      onClick={() => onPick(e)}
                      title={e.title}
                    >
                      {e.title}
                    </button>
                  ))}
              </div>
            ))}
          </div>
        )}

        <div className="cal-week-body" ref={bodyRef}>
          <div className="cal-week-hours" style={{ height: 24 * HOUR_PX }}>
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="cal-week-hour" style={{ height: HOUR_PX }}>
                {h > 0 && <span>{fmtHour(h)}</span>}
              </div>
            ))}
          </div>
          <div
            className="cal-week-cols"
            style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)`, height: 24 * HOUR_PX }}
          >
            {days.map((d) => {
              const placed = layoutDay((byDay.get(ymd(d)) ?? []).filter((e) => !e.allDay), d);
              return (
                <div key={ymd(d)} className={`cal-week-col ${sameYmd(d, today) ? "today" : ""}`}>
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} className="cal-week-line" style={{ top: h * HOUR_PX }} />
                  ))}
                  {sameYmd(d, today) && <div className="cal-week-now" style={{ top: nowTop }} />}
                  {placed.map((p) => (
                    <button
                      key={p.e.id}
                      className={`cal-week-ev${p.e.provider === "planned" ? " planned" : ""}`}
                      style={
                        {
                          top: p.top,
                          height: p.height,
                          left: `calc(${(p.lane / p.lanes) * 100}% + 1px)`,
                          width: `calc(${(1 / p.lanes) * 100}% - 2px)`,
                          "--ev": PROVIDER_COLOR[p.e.provider],
                        } as CSSProperties
                      }
                      onClick={() => onPick(p.e)}
                      title={`${p.e.title} · ${fmtTime(p.e.start)}`}
                    >
                      <span className="cal-week-ev-t">{fmtTime(p.e.start)}</span>
                      <span className="cal-week-ev-title">{p.e.title}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function EventDetail({ ev, onClose, onDelete }: { ev: CalEvent; onClose: () => void; onDelete: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <span className="cal-dot" style={{ background: PROVIDER_COLOR[ev.provider] }} /> {ev.title}
        </div>
        <div className="modal-body">
          <div className="cal-meta">
            {ev.allDay
              ? "All day"
              : `${new Date(ev.start).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} – ${fmtTime(ev.end)}`}
          </div>
          {ev.location && <div className="cal-meta">📍 {ev.location}</div>}
          {ev.description && <div className="cal-desc">{ev.description}</div>}
          <div className="cal-meta muted">{PROVIDER_LABEL[ev.provider]}</div>
        </div>
        <div className="modal-foot">
          {ev.link && (
            <a className="btn small" href={ev.link} target="_blank" rel="noopener noreferrer">
              Open
            </a>
          )}
          <span className="spacer" />
          {ev.provider !== "planned" && (
            <button className="btn small" onClick={onDelete}>
              Delete
            </button>
          )}
          <button className="btn btn-primary small" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function Compose({
  conn,
  day,
  onClose,
  onCreated,
}: {
  conn: Record<CalProvider, boolean>;
  day: string | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const providers = (["google", "microsoft"] as CalProvider[]).filter((p) => conn[p]);
  const [provider, setProvider] = useState<CalProvider>(providers[0]);
  const [title, setTitle] = useState("");
  const [allDay, setAllDay] = useState(false);
  const base = day ?? ymd(new Date());
  const [start, setStart] = useState(`${base}T09:00`);
  const [end, setEnd] = useState(`${base}T10:00`);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    if (!title.trim()) return setErr("Title required");
    setSaving(true);
    setErr("");
    try {
      await createEvent({
        provider,
        title: title.trim(),
        allDay,
        start: allDay ? `${start.slice(0, 10)}T00:00:00Z` : new Date(start).toISOString(),
        end: allDay ? `${end.slice(0, 10)}T00:00:00Z` : new Date(end).toISOString(),
      });
      onCreated();
    } catch (e) {
      setErr((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">New event</div>
        <div className="modal-body cal-form">
          <input
            className="cal-input"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
          <label className="cal-check">
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> All day
          </label>
          <div className="cal-times">
            <input
              className="cal-input"
              type={allDay ? "date" : "datetime-local"}
              value={allDay ? start.slice(0, 10) : start}
              onChange={(e) => setStart(allDay ? `${e.target.value}T00:00` : e.target.value)}
            />
            <span className="muted">to</span>
            <input
              className="cal-input"
              type={allDay ? "date" : "datetime-local"}
              value={allDay ? end.slice(0, 10) : end}
              onChange={(e) => setEnd(allDay ? `${e.target.value}T00:00` : e.target.value)}
            />
          </div>
          {providers.length > 1 && (
            <div className="cal-provsel">
              {providers.map((p) => (
                <button
                  key={p}
                  className={`chip ${provider === p ? "active" : ""}`}
                  onClick={() => setProvider(p)}
                >
                  {PROVIDER_LABEL[p]}
                </button>
              ))}
            </div>
          )}
          {err && <div className="mic-err">{err}</div>}
        </div>
        <div className="modal-foot">
          <span className="spacer" />
          <button className="btn small" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary small" onClick={save} disabled={saving}>
            {saving ? "Saving…" : `Add to ${PROVIDER_LABEL[provider]}`}
          </button>
        </div>
      </div>
    </div>
  );
}
