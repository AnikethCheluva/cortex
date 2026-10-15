"use client";

import {
  useCallback,
  useLayoutEffect,
  useId,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import {
  connections,
  createEvent,
  setGoogleEventColor,
  deleteEvent,
  listEvents,
  providerConfigured,
  signIn,
  signOut,
  PROVIDER_LABEL,
  type CalEvent,
  type CalProvider,
  type ConnectedProvider,
} from "@/lib/calendar";
import {
  COLOR_STORAGE_KEY,
  EVENT_COLORS,
  colorHex,
  eventKey,
  readEventColors,
} from "@/lib/calendar/colors";
import { eventMeetingUrl, meetingLabel } from "@/lib/calendar/meetings";
import { planTaskTimeboxes, TIMEBOX_HORIZON_DAYS, type TaskTimebox } from "@/lib/calendar/timeboxing";
import { plannedToEvents } from "@/lib/calendar/planned";
import {
  addDays,
  dateKey,
  HOUR_PX,
  indexEvents,
  layoutDay,
  monthDays,
  selectionRange,
  taskEvents,
  weekDays,
} from "@/lib/calendar/layout";
import { shiftDate } from "@/lib/task-dates";
import type { PlannedEvent, Task } from "@/lib/types";
import { Icon } from "./Icon";
import { Dialog } from "./Dialog";
import { useMobile } from "@/lib/useMobile";

type View = "day" | "three-day" | "week" | "month" | "agenda";
type EventSelection = { day: string; minute: number; endMinute?: number };
type ConnectionState = Record<CalProvider, boolean>;
const PROVIDERS: ConnectedProvider[] = ["google", "microsoft"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const COLORS: Record<CalProvider, string> = {
  google: "var(--info)",
  microsoft: "var(--claude)",
  planned: "var(--accent)",
  tasks: "var(--ok)",
};
const eventStyle = (event: CalEvent) =>
  ({ "--ev": event.color || COLORS[event.provider] }) as CSSProperties;
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const fmtDate = (date: Date) =>
  date.toLocaleDateString([], { month: "long", year: "numeric" });
const fmtHour = (hour: number) =>
  hour === 0
    ? "12 AM"
    : hour < 12
      ? `${hour} AM`
      : hour === 12
        ? "12 PM"
        : `${hour - 12} PM`;

export function CalendarTab({
  planned = [],
  tasks = [],
  openTask,
  rescheduleTask,
  saveTimeboxes = async () => {},
  estimateTasks = async () => ({}),
  timeboxRequest = 0,
}: {
  planned?: PlannedEvent[];
  tasks?: Task[];
  openTask: (id: string) => void;
  rescheduleTask: (id: string, due: string) => Promise<void>;
  saveTimeboxes?: (timeboxes: TaskTimebox[]) => Promise<void>;
  estimateTasks?: (tasks: Task[]) => Promise<Record<string, number>>;
  timeboxRequest?: number;
}) {
  const [cursor, setCursor] = useState(() => new Date());
  const [scrollAnchor, setScrollAnchor] = useState(() => new Date());
  const [view, setView] = useState<View>("week");
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pickerCursor, setPickerCursor] = useState(() => new Date());
  const [monthAnchor, setMonthAnchor] = useState(() => monthDays(new Date())[0]);
  const [eventState, setEventState] = useState<{
    key: string;
    events: CalEvent[];
  }>({ key: "", events: [] });
  const [conn, setConn] = useState<ConnectionState>({
    google: false,
    microsoft: false,
    planned: false,
    tasks: false,
  });
  const [visible, setVisible] = useState<ConnectionState>({
    google: true,
    microsoft: true,
    planned: true,
    tasks: true,
  });
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState<ConnectedProvider | null>(null);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<CalEvent | null>(null);
  const [compose, setCompose] = useState<EventSelection | null>(null);
  const [timeboxing, setTimeboxing] = useState(false);
  const [timeboxNotice, setTimeboxNotice] = useState("");
  const [eventColors, setEventColors] = useState<Record<string, string>>({});
  useEffect(() => {
    setEventColors(readEventColors());
    const sync = (event: StorageEvent) => {
      if (event.key === COLOR_STORAGE_KEY || event.key === null)
        setEventColors(readEventColors());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  function saveLocalColor(event: CalEvent, colorId: string) {
    const next = { ...readEventColors() };
    if (colorId) next[eventKey(event)] = colorId;
    else delete next[eventKey(event)];
    localStorage.setItem(COLOR_STORAGE_KEY, JSON.stringify(next));
    setEventColors(next);
  }
  const [now, setNow] = useState(() => new Date());
  const request = useRef(0);
  const periodSwipe = useRef<{
    x: number;
    y: number;
    pointer: number;
  } | null>(null);
  const wheelTravel = useRef({ distance: 0, direction: 0, movedAt: 0 });
  const suppressPeriodClick = useRef(false);
  const handledTimeboxRequest = useRef(0);
  const mobile = useMobile();
  const effectiveView = mobile && (view === "week" || view === "month") ? "three-day" : view;
  const day = dateKey(cursor);
  const today = dateKey(now);
  const grid = useMemo(() => monthDays(cursor), [cursor]);
  // The desktop week is a rolling seven-day window. Gesture navigation moves
  // that window one day at a time, while the explicit previous/next controls
  // still offer the faster seven-day jump.
  const week = useMemo(
    () => Array.from({ length: 7 }, (_, offset) => addDays(cursor, offset)),
    [cursor],
  );
  const weekStrip = useMemo(() => weekDays(cursor), [cursor]);
  const days = useMemo(
    () =>
      effectiveView === "day"
        ? [new Date(`${day}T00:00:00`)]
        : effectiveView === "three-day"
          ? week.slice(0, 3)
        : effectiveView === "week"
          ? week
          : grid,
    [day, effectiveView, week, grid],
  );
  const scrollingDates = effectiveView === "week" || effectiveView === "day" || effectiveView === "three-day";
  const visibleDays = effectiveView === "week" ? 7 : effectiveView === "three-day" ? 3 : 1;
  // Keep two weeks on either side mounted and fetched. Cursor updates after a
  // native scroll settles do not rebuild the strip or refetch the same dates.
  const bufferedDays = useMemo(() => Array.from(
    { length: 28 + visibleDays }, (_, index) => addDays(scrollAnchor, index - 14),
  ), [scrollAnchor, visibleDays]);
  useEffect(() => {
    const distance = Math.abs((addDays(cursor, 0).getTime() - addDays(scrollAnchor, 0).getTime()) / 86_400_000);
    if (distance > 7) setScrollAnchor(addDays(cursor, 0));
  }, [cursor, scrollAnchor]);
  const monthBuffer = useMemo(() => Array.from({ length: 126 }, (_, index) => addDays(monthAnchor, index - 42)), [monthAnchor]);
  const renderedDays = scrollingDates ? bufferedDays : days;
  const start = renderedDays[0].toISOString(),
    end = addDays(renderedDays[renderedDays.length - 1], 1).toISOString();
  const rangeKey = `${start}/${end}`;
  const allEvents = useMemo(() => {
    const events = eventState.events; // Retain cached events throughout refreshes.
    return [
      ...events,
      ...plannedToEvents(planned, start, end),
      ...taskEvents(tasks),
    ]
      .map((event) => {
        const colorId =
          event.provider === "google" && !event.colorReadOnly
            ? undefined
            : eventColors[eventKey(event)];
        return colorId
          ? { ...event, color: colorHex(colorId), colorId }
          : event;
      })
      .filter((event) => visible[event.provider])
      .sort((a, b) => a.start.localeCompare(b.start));
  }, [
    eventState,
    rangeKey,
    planned,
    start,
    end,
    tasks,
    visible,
    eventColors,
  ]);
  const byDay = useMemo(() => indexEvents(allEvents, renderedDays), [allEvents, renderedDays]);
  const refresh = useCallback(async () => {
    const version = ++request.current;
    setLoading(true);
    setError("");
    try {
      const connected = await connections();
      if (version !== request.current) return;
      setConn(connected);
      const events = await listEvents(start, end);
      if (version === request.current)
        setEventState((previous) => {
          // Replace refreshed dates (including deletions), retain nearby cached
          // dates, and bound memory while browsing through months of history.
          const from = new Date(start).getTime(), to = new Date(end).getTime();
          const margin = 90 * 86_400_000;
          const retained = previous.events.filter((event) => {
            const eventStart = new Date(event.start).getTime(), eventEnd = new Date(event.end).getTime();
            return (eventEnd <= from || eventStart >= to) && eventEnd >= from - margin && eventStart <= to + margin;
          });
          return { key: `${start}/${end}`, events: [...new Map([...retained, ...events].map((event) => [eventKey(event), event])).values()] };
        });
    } catch (err) {
      if (version === request.current)
        setError(`Could not refresh your calendars. ${(err as Error).message}`);
    } finally {
      if (version === request.current) setLoading(false);
    }
  }, [start, end]);
  useEffect(() => {
    void refresh();
    return () => {
      request.current++;
    };
  }, [refresh]);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("cortex:calendar") || "null",
      );
      if (saved?.visible)
        setVisible(
          (current) =>
            Object.fromEntries(
              Object.entries(current).map(([key, value]) => [
                key,
                typeof saved.visible[key] === "boolean"
                  ? saved.visible[key]
                  : value,
              ]),
            ) as ConnectionState,
        );
      if (["day", "three-day", "week", "month", "agenda"].includes(saved?.view))
        setView(saved.view);
    } catch {
      /* Browser storage is optional. */
    }
  }, []);
  function openMonthPicker() {
    setPickerCursor(cursor);
    setMonthAnchor(monthDays(cursor)[0]);
    setMonthPickerOpen(true);
  }
  function changeView(next: View) {
    if (mobile && next === "month") {
      openMonthPicker();
      if (effectiveView === "agenda") { setView("three-day"); persist(visible, "three-day"); }
      return;
    }
    setView(next);
    persist(visible, next);
  }
  function persist(sources: ConnectionState, next: View) {
    try {
      localStorage.setItem(
        "cortex:calendar",
        JSON.stringify({ visible: sources, view: next }),
      );
    } catch {}
  }
  function toggleSource(provider: CalProvider) {
    const next = { ...visible, [provider]: !visible[provider] };
    setVisible(next);
    persist(next, view);
  }
  const step = useCallback(
    (direction: number) =>
      setCursor((date) =>
        effectiveView === "day"
          ? addDays(date, direction)
          : effectiveView === "three-day"
            ? addDays(date, direction * 3)
          : effectiveView === "week"
            ? addDays(date, direction * 7)
            : new Date(date.getFullYear(), date.getMonth() + direction, 1),
      ),
    [effectiveView],
  );
  const stepByGesture = useCallback(
    (direction: number) =>
      setCursor((date) =>
        effectiveView === "week" || effectiveView === "day" || effectiveView === "three-day"
          ? addDays(date, direction)
          : new Date(date.getFullYear(), date.getMonth() + direction, 1),
      ),
    [effectiveView],
  );
  function onPeriodWheel(event: ReactWheelEvent<HTMLDivElement>) {
    if (scrollingDates) return; // Native scrolling and CSS day snapping own this gesture.
    const scale = event.deltaMode === 1 ? 16 : 1;
    const horizontal = event.deltaX * scale;
    const vertical = event.deltaY * scale;
    if (!horizontal || Math.abs(horizontal) <= Math.abs(vertical) * 1.15)
      return;

    event.preventDefault();
    const direction = Math.sign(horizontal);
    const tracker = wheelTravel.current;
    if (tracker.direction && tracker.direction !== direction) {
      tracker.distance = 0;
      tracker.direction = direction;
    }
    tracker.direction = direction;
    tracker.distance += horizontal;
    if (
      Math.abs(tracker.distance) >= 72 &&
      Date.now() - tracker.movedAt >= 350
    ) {
      stepByGesture(direction);
      tracker.distance = 0;
      tracker.movedAt = Date.now();
    }
  }
  function onPeriodPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (scrollingDates || event.pointerType !== "touch" || event.isPrimary === false) return;
    periodSwipe.current = {
      x: event.clientX,
      y: event.clientY,
      pointer: event.pointerId,
    };
  }
  function onPeriodPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const start = periodSwipe.current;
    periodSwipe.current = null;
    if (!start || start.pointer !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < 48 || Math.abs(dx) <= Math.abs(dy) * 1.25) return;

    // A horizontal swipe changes period. Vertical movement remains native time
    // scrolling, and a tap continues to open or create an event as before.
    event.preventDefault();
    suppressPeriodClick.current = true;
    stepByGesture(dx < 0 ? 1 : -1);
    window.setTimeout(() => {
      suppressPeriodClick.current = false;
    }, 0);
  }
  const connected = conn.google || conn.microsoft;
  async function autoTimebox() {
    if (timeboxing) return;
    setTimeboxing(true);
    setError("");
    setTimeboxNotice("");
    try {
      // Fetch the entire planning horizon even in day view or when browsing
      // another month. A failed calendar fetch must stop scheduling.
      const planningNow = new Date();
      const horizonStart = new Date(planningNow);
      horizonStart.setHours(0, 0, 0, 0);
      const horizonEnd = addDays(horizonStart, TIMEBOX_HORIZON_DAYS);
      const external = await listEvents(horizonStart.toISOString(), horizonEnd.toISOString());
      const busy = [...external, ...plannedToEvents(planned, horizonStart.toISOString(), horizonEnd.toISOString())];
      let estimates: Record<string, number> = {};
      let usedFallback = false;
      try {
        estimates = await estimateTasks(tasks);
      } catch {
        usedFallback = true;
      }
      const timeboxes = planTaskTimeboxes(tasks, busy, new Date(), estimates);
      const scheduledIds = new Set(timeboxes.map((box) => box.taskId));
      const unscheduled = tasks.filter((task) => task.status !== "done" && !scheduledIds.has(task.id));
      const missed = unscheduled.length
        ? ` Could not fit before the due date or within the next 14 days: ${unscheduled.map((task) => `${task.title}${task.due_date ? ` (due ${task.due_date})` : ""}`).join("; ")}. Existing blocks for these tasks are unchanged; review their dates or estimates.`
        : "";
      if (!timeboxes.length) throw new Error(`No full task blocks could fit.${missed}`);
      await saveTimeboxes(timeboxes);
      setTimeboxNotice(
        `Scheduled ${timeboxes.length} focus block${timeboxes.length === 1 ? "" : "s"} by priority, respecting due dates and full task estimates.` +
        (timeboxes.some((box) => box.dueDate) ? ` Set due dates from available slots for ${timeboxes.filter((box) => box.dueDate).length} tasks without deadlines.` : "") +
        (usedFallback ? " Codex was unavailable, so missing estimates use local estimates." : "") + missed,
      );
    } catch (err) {
      setError(`Could not timebox your tasks. ${(err as Error).message}`);
    } finally {
      setTimeboxing(false);
    }
  }
  useEffect(() => {
    if (
      !timeboxRequest ||
      handledTimeboxRequest.current === timeboxRequest ||
      loading ||
      eventState.key !== rangeKey
    )
      return;
    handledTimeboxRequest.current = timeboxRequest;
    void autoTimebox();
  // autoTimebox intentionally uses the current task and calendar snapshots.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeboxRequest, loading, eventState.key, rangeKey]);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        (target instanceof Element &&
          target.closest(
            "input, textarea, select, [contenteditable=true], dialog",
          )) ||
        detail ||
        compose
      )
        return;
      const key = event.key.toLowerCase();
      if (key === "t") setCursor(new Date());
      else if (key === "d") changeView("day");
      else if (key === "w") changeView("week");
      else if (key === "m") changeView("month");
      else if (key === "a") changeView("agenda");
      else if (key === "n" && connected) setCompose({ day, minute: 9 * 60 });
      else if (key === "arrowleft" && target === document.body) step(-1);
      else if (key === "arrowright" && target === document.body) step(1);
      else return;
      event.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  async function connection(provider: ConnectedProvider, disconnect = false) {
    setConnecting(provider);
    setError("");
    try {
      if (disconnect) await signOut(provider);
      else await signIn(provider);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setConnecting(null);
    }
  }
  async function dropTask(event: DragEvent, date: string) {
    event.preventDefault();
    event.currentTarget.classList.remove("drop-target");
    const id = event.dataTransfer.getData("application/cortex-task");
    if (!tasks.some((task) => task.id === id)) return;
    setError("");
    try {
      await rescheduleTask(id, date);
    } catch (err) {
      setError(`Could not reschedule task. ${(err as Error).message}`);
    }
  }
  function dragOver(event: DragEvent) {
    if (event.dataTransfer.types.includes("application/cortex-task")) {
      event.preventDefault();
      event.currentTarget.classList.add("drop-target");
      event.dataTransfer.dropEffect = "move";
    }
  }
  const dropProps = (date: string) => ({
    onDragOver: dragOver,
    onDragLeave: (event: DragEvent) =>
      event.currentTarget.classList.remove("drop-target"),
    onDrop: (event: DragEvent) => void dropTask(event, date),
  });
  const label =
    effectiveView === "day"
      ? cursor.toLocaleDateString([], {
          weekday: "long",
          month: "long",
          day: "numeric",
        })
      : effectiveView === "week" || effectiveView === "three-day"
        ? `${week[0].toLocaleDateString([], { month: "short", day: "numeric" })} – ${week[effectiveView === "three-day" ? 2 : 6].toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`
        : fmtDate(cursor);

  function renderMonthDay(date: Date) {
                    const key = dateKey(date),
                      events = byDay.get(key) ?? [];
                    return (
                      <div
                        className={`calendar-month-cell ${date.getMonth() !== cursor.getMonth() ? "outside-month" : ""} ${key === today ? "is-today" : ""}`}
                        key={key}
                        {...dropProps(key)}
                      >
                        <button
                          className="month-date"
                          aria-label={`View ${date.toLocaleDateString([], { dateStyle: "full" })}`}
                          onClick={() => {
                            setCursor(date);
                            changeView("day");
                          }}
                        >
                          {date.getDate()}
                        </button>
                        <div className="month-events">
                          {events.slice(0, mobile ? 2 : 3).map((event) => (
                            <EventChip
                              key={eventKey(event)}
                              event={event}
                              onPick={setDetail}
                            />
                          ))}
                          {events.length > (mobile ? 2 : 3) && (
                            <button
                              className="month-more"
                              onClick={() => {
                                setCursor(date);
                                changeView("day");
                              }}
                            >
                              +{events.length - (mobile ? 2 : 3)} more
                            </button>
                          )}
                        </div>
                      </div>
                    );
  }
  return (
    <section className="calendar-workspace">
      <div className="page-heading calendar-heading">
        <div>
          <h1>Calendar</h1>
        </div>
          <div className="calendar-toolbar">
            <div className="calendar-range">
              <button className="btn" aria-label="Today" title="Go to today" onClick={() => setCursor(new Date())}>
                {mobile ? now.getDate() : "Today"}
              </button>
              <button
                className="icon-button"
                aria-label="Previous period"
                onClick={() => step(-1)}
              >
                <Icon name="chevron" style={{ transform: "rotate(180deg)" }} />
              </button>
              <button
                className="icon-button"
                aria-label="Next period"
                onClick={() => step(1)}
              >
                <Icon name="chevron" />
              </button>
              {!mobile && <h2>{label}</h2>}
            </div>
            <div className="calendar-tools">
              <div className="calendar-heading-actions">
                <button
                  className="btn calendar-timebox-action"
                  aria-label={timeboxing ? "Timeboxing…" : "Auto timebox"}
                  onClick={() => void autoTimebox()}
                  disabled={timeboxing || !tasks.some((task) => task.status !== "done")}
                  title="Place open tasks into focused work blocks"
                >
                  <Icon name="clock" size={16} />
                  <span>{timeboxing ? "Timeboxing…" : "Auto timebox"}</span>
                </button>
                <button
                  className="btn btn-primary calendar-create-action"
                  aria-label="New event"
                  onClick={() => setCompose({ day, minute: 9 * 60 })}
                  disabled={!connected}
                  title={
                    !connected
                      ? "Connect Google or Outlook to create events"
                      : "New event (N)"
                  }
                >
                  <Icon name="plus" />
                  <span>New event</span>
                </button>
              </div>
              <button
                className={`icon-button ${loading ? "is-syncing" : ""}`}
                disabled={loading}
                aria-label="Refresh calendars"
                onClick={() => void refresh()}
              >
                <Icon name="refresh" size={16} />
              </button>
              <select
                aria-label="Calendar view"
                value={effectiveView}
                onChange={(event) => changeView(event.target.value as View)}
              >
                <option value="day">Day</option>
                <option value="three-day">3 days</option>
                {!mobile && <option value="week">Week</option>}
                {!mobile && <option value="month">Month</option>}
                <option value="agenda">Agenda</option>
              </select>
            </div>
          </div>
      </div>
      {mobile && <div className="calendar-phone-date-row"><h2>{mobile ? <><button className="calendar-month-toggle" aria-label="Choose calendar date" aria-expanded={monthPickerOpen} aria-controls="phone-month-picker" onClick={() => monthPickerOpen ? setMonthPickerOpen(false) : openMonthPicker()}>{fmtDate(monthPickerOpen ? pickerCursor : cursor)}<Icon name="chevron" size={14} style={{ transform: monthPickerOpen ? "rotate(-90deg)" : "rotate(90deg)" }} /></button><span className="sr-only">{label}</span></> : label}</h2>
{mobile && (
            <details className="calendar-phone-settings">
              <summary>
                Calendars <Icon name="chevron" size={14} />
              </summary>
              <div className="calendar-mobile-sources">
                {(
                  [
                    "tasks",
                    "planned",
                    ...PROVIDERS.filter(providerConfigured),
                  ] as CalProvider[]
                ).map((provider) => (
                  <button
                    key={provider}
                    className="chip"
                    aria-pressed={visible[provider]}
                    onClick={() =>
                      PROVIDERS.includes(provider as ConnectedProvider) &&
                      !conn[provider]
                        ? void connection(provider as ConnectedProvider)
                        : toggleSource(provider)
                    }
                  >
                    <span
                      className="cal-dot"
                      style={{
                        background: COLORS[provider],
                        opacity: visible[provider] ? 1 : 0.3,
                      }}
                    />
                    {PROVIDER_LABEL[provider]}
                    {PROVIDERS.includes(provider as ConnectedProvider) &&
                    !conn[provider]
                      ? " · Connect"
                      : ""}
                  </button>
                ))}
                <button
                  className="chip"
                  disabled={loading}
                  onClick={() => void refresh()}
                >
                  <Icon name="refresh" size={14} />
                  Refresh
                </button>
                {PROVIDERS.filter((provider) => conn[provider]).map(
                  (provider) => (
                    <button
                      key={`disconnect-${provider}`}
                      className="chip"
                      disabled={connecting === provider}
                      onClick={() => void connection(provider, true)}
                    >
                      Disconnect {PROVIDER_LABEL[provider]}
                    </button>
                  ),
                )}
              </div>
            </details>
          )}
</div>}
      {mobile && monthPickerOpen && (
        <div id="phone-month-picker" className="calendar-phone-month">
          <div className="calendar-month-weekdays">{DOW.map(name => <span key={name}>{name.slice(0, 2)}</span>)}</div>
          <RollingMonthGrid dates={monthBuffer} cursor={pickerCursor} onDateChange={setPickerCursor} onAnchorChange={setMonthAnchor} renderDay={date => <button key={dateKey(date)} className={`calendar-picker-day ${dateKey(date) === day ? "selected" : ""} ${dateKey(date) === today ? "today" : ""} ${date.getMonth() !== pickerCursor.getMonth() ? "dim" : ""}`} aria-label={date.toLocaleDateString([], {dateStyle:"full"})} aria-pressed={dateKey(date) === day} onClick={() => { setCursor(date); setMonthPickerOpen(false); if (effectiveView === "agenda") changeView("three-day"); }}>{date.getDate()}</button>} />
        </div>
      )}
      <div className="calendar-shell">
        <aside className="calendar-sidebar">
          <MiniMonth cursor={cursor} today={today} onPick={setCursor} />
          <div className="calendar-sources">
            <div className="eyebrow">My calendars</div>
            {(["tasks", "planned", "google", "microsoft"] as CalProvider[]).map(
              (provider) => {
                const external =
                  provider === "google" || provider === "microsoft";
                if (external && !providerConfigured(provider)) return null;
                return (
                  <div className="calendar-source" key={provider}>
                    <button
                      aria-pressed={
                        visible[provider] && (!external || conn[provider])
                      }
                      onClick={() =>
                        external && !conn[provider]
                          ? void connection(provider)
                          : toggleSource(provider)
                      }
                      disabled={connecting === provider}
                      className="source-toggle"
                    >
                      <span
                        className={`source-check ${visible[provider] && (!external || conn[provider]) ? "on" : ""}`}
                        style={{ "--ev": COLORS[provider] } as CSSProperties}
                      >
                        <Icon name="check" size={12} />
                      </span>
                      <span>{PROVIDER_LABEL[provider]}</span>
                      {external && !conn[provider] && (
                        <small>
                          {connecting === provider ? "…" : "Connect"}
                        </small>
                      )}
                    </button>
                    {external && conn[provider] && (
                      <button
                        className="source-disconnect"
                        aria-label={`Disconnect ${PROVIDER_LABEL[provider]}`}
                        disabled={connecting === provider}
                        onClick={() => void connection(provider, true)}
                      >
                        <Icon name="close" size={12} />
                      </button>
                    )}
                  </div>
                );
              },
            )}
          </div>
          <div className="calendar-shortcuts">
            <span>
              <kbd>T</kbd> Today
            </span>
            <span>
              <kbd>W</kbd> Week
            </span>
            <span>
              <kbd>M</kbd> Month
            </span>
            <span>
              <kbd>N</kbd> New event
            </span>
          </div>
        </aside>
        <div className="calendar-content">
          {error && (
            <div className="banner" role="alert">
              {error}
              <button className="inline-link" onClick={() => void refresh()}>
                Retry
              </button>
            </div>
          )}
          {timeboxNotice && !error && (
            <div className="banner calendar-timebox-note" role="status">
              {timeboxNotice}
            </div>
          )}

          <div
            className="calendar-gesture-surface"
            role="region"
            aria-label="Calendar period. Scroll sideways to browse dates."
            onWheel={onPeriodWheel}
            onPointerDownCapture={onPeriodPointerDown}
            onPointerUpCapture={onPeriodPointerUp}
            onPointerCancelCapture={() => {
              periodSwipe.current = null;
            }}
            onClickCapture={(event) => {
              if (!suppressPeriodClick.current) return;
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            {mobile && effectiveView === "day" && !monthPickerOpen && (
              <div className="calendar-week-strip">
                {weekStrip.map((date) => (
                  <button
                    key={dateKey(date)}
                    className={dateKey(date) === day ? "selected" : ""}
                    onClick={() => setCursor(date)}
                  >
                    <span>{DOW[date.getDay()]}</span>
                    <b>{date.getDate()}</b>
                  </button>
                ))}
              </div>
            )}
            <div className="calendar-view-enter" key={effectiveView}>
            {(effectiveView === "week" || effectiveView === "day" || effectiveView === "three-day") && (
              <TimeGrid
                days={renderedDays}
                visibleDays={visibleDays}
                cursor={cursor}
                onDateChange={setCursor}
                byDay={byDay}
                now={now}
                onPick={setDetail}
                onCompose={
                  connected
                    ? (date, minute, endMinute) =>
                        setCompose({ day: date, minute, endMinute })
                    : undefined
                }
                dropProps={dropProps}
              />
            )}
            {effectiveView === "month" && (
              <div className="calendar-month">
                <div className="calendar-month-weekdays">
                  {DOW.map((name) => (
                    <span key={name}>{name}</span>
                  ))}
                </div>
                <div className="calendar-month-grid">{grid.map(renderMonthDay)}</div>
              </div>
            )}
            {effectiveView === "agenda" && (
              <Agenda byDay={byDay} today={today} onPick={setDetail} />
            )}
            </div>
          </div>
          <div className="calendar-bottom-note">
            <span>
              {connected
                ? "Swipe or scroll sideways to change dates · Drag to create an event"
                : "Connect a calendar to add meetings and time blocks"}
            </span>
          </div>
        </div>
      </div>
      {detail && (
        <EventDetail
          key={eventKey(detail)}
          event={detail}
          onColorChange={async (colorId) => {
            const syncToGoogle =
              detail.provider === "google" && !detail.colorReadOnly;
            if (syncToGoogle) await setGoogleEventColor(detail, colorId);
            else saveLocalColor(detail, colorId);
            const original = eventState.events.find(
              (event) => eventKey(event) === eventKey(detail),
            );
            const updated = {
              ...detail,
              colorId:
                colorId || (!syncToGoogle ? original?.colorId : undefined),
              color:
                colorHex(colorId) ??
                (syncToGoogle ? detail.calendarColor : original?.color),
            };
            setDetail((current) =>
              current && eventKey(current) === eventKey(detail)
                ? updated
                : current,
            );
            if (syncToGoogle)
              setEventState((state) => ({
                ...state,
                events: state.events.map((event) =>
                  eventKey(event) === eventKey(detail) ? updated : event,
                ),
              }));
          }}
          onClose={() => setDetail(null)}
          openTask={openTask}
          onDelete={async () => {
            await deleteEvent(detail);
            setDetail((current) =>
              current && eventKey(current) === eventKey(detail)
                ? null
                : current,
            );
            await refresh();
          }}
        />
      )}
      {compose && (
        <Compose
          conn={conn}
          initial={compose}
          onClose={() => setCompose(null)}
          onCreated={async (created, colorId) => {
            setCompose(null);
            await refresh();
            if (created.provider !== "google" && colorId) {
              try {
                saveLocalColor(created, colorId);
              } catch {
                setError(
                  "Event created, but its color could not be saved in this browser.",
                );
              }
            }
          }}
        />
      )}
    </section>
  );
}

function RollingMonthGrid({ dates, cursor, onDateChange, onAnchorChange, renderDay }: {
  dates: Date[]; cursor: Date; onDateChange: (date: Date) => void;
  onAnchorChange: (date: Date) => void; renderDay: (date: Date) => ReactNode;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const rowHeight = useRef(80);
  const topWeek = useRef(monthDays(cursor)[0]);
  const emitted = useRef("");
  const offset = useRef(0);
  const touching = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useLayoutEffect(() => {
    const node = scroller.current;
    if (!node) return;
    if (emitted.current !== dateKey(cursor)) topWeek.current = monthDays(cursor)[0];
    const index = dates.findIndex(date => dateKey(date) === dateKey(topWeek.current));
    if (index < 0 || index > dates.length - 42) { onAnchorChange(topWeek.current); return; }
    const align = () => {
      rowHeight.current = Math.max(1, node.clientHeight / 6);
      node.style.setProperty("--month-week-height", `${rowHeight.current}px`);
      offset.current = index / 7 * rowHeight.current;
      node.scrollTop = offset.current;
    };
    align();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(align);
    observer?.observe(node);
    return () => observer?.disconnect();
  }, [dates, cursor, onAnchorChange]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  function settle() {
    const node = scroller.current;
    if (!node || touching.current || Math.abs(node.scrollTop - offset.current) < 1) return;
    const index = Math.max(0, Math.min(dates.length / 7 - 6, Math.round(node.scrollTop / rowHeight.current)));
    const date = dates[index * 7];
    offset.current = index * rowHeight.current;
    topWeek.current = date;
    const middle = addDays(date, 3);
    emitted.current = dateKey(middle);
    onDateChange(middle);
    if (index < 2 || index > 10) onAnchorChange(date);
  }
  function schedule() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(settle, 180);
  }
  return <div ref={scroller} tabIndex={0} className="calendar-month-scroll" role="region" aria-label="Month calendar. Scroll vertically by week." onScroll={schedule} onPointerDown={() => { touching.current = true; }} onPointerUp={() => { touching.current = false; schedule(); }} onPointerCancel={() => { touching.current = false; schedule(); }}>
    {Array.from({ length: dates.length / 7 }, (_, week) => <div className="calendar-month-week" key={dateKey(dates[week * 7])}>{dates.slice(week * 7, week * 7 + 7).map(renderDay)}</div>)}
  </div>;
}

function MiniMonth({
  cursor,
  today,
  onPick,
  rangeDays = 1,
}: {
  cursor: Date;
  today: string;
  rangeDays?: number;
  onPick: (date: Date) => void;
}) {
  const [month, setMonth] = useState(cursor);
  useEffect(() => setMonth(cursor), [cursor]);
  return (
    <div className="calendar-mini">
      <div className="calendar-mini-heading">
        <strong>{fmtDate(month)}</strong>
        <div>
          <button
            className="icon-button"
            aria-label="Previous month"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
            }
          >
            <Icon
              name="chevron"
              size={14}
              style={{ transform: "rotate(180deg)" }}
            />
          </button>
          <button
            className="icon-button"
            aria-label="Next month"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
            }
          >
            <Icon name="chevron" size={14} />
          </button>
        </div>
      </div>
      <div className="calendar-mini-grid">
        {DOW.map((name) => (
          <span key={name} className="mini-weekday">
            {name.slice(0, 2)}
          </span>
        ))}
        {monthDays(month).map((date) => (
          <button
            key={dateKey(date)}
            aria-label={date.toLocaleDateString([], { dateStyle: "full" })}
            aria-pressed={dateKey(date) === dateKey(cursor)}
            className={`${dateKey(date) >= dateKey(cursor) && dateKey(date) < dateKey(addDays(cursor, rangeDays)) ? "in-range" : ""} ${date.getMonth() !== month.getMonth() ? "dim" : ""} ${dateKey(date) === today ? "today" : ""} ${dateKey(date) === dateKey(cursor) ? "selected" : ""}`}
            onClick={() => onPick(date)}
          >
            {date.getDate()}
          </button>
        ))}
      </div>
    </div>
  );
}
function EventChip({
  event,
  onPick,
}: {
  event: CalEvent;
  onPick: (event: CalEvent) => void;
}) {
  return (
    <div className="calendar-chip-wrap">
      <button
        className={`calendar-event-chip source-${event.provider}`}
        style={eventStyle(event)}
        onClick={() => onPick(event)}
        title={`${event.title}${event.allDay ? " · All day" : ` · ${fmtTime(event.start)}`}`}
        draggable={!!event.taskId}
        onDragStart={(drag) => {
          if (event.taskId) {
            drag.dataTransfer.setData("application/cortex-task", event.taskId);
            drag.dataTransfer.effectAllowed = "move";
          }
        }}
      >
        {event.taskId ? (
          <Icon name="tasks" size={12} />
        ) : (
          <span className="event-dot" />
        )}
        {!event.allDay && <small>{fmtTime(event.start)}</small>}
        <span>{event.title}</span>
      </button>
      <QuickJoin event={event} />
    </div>
  );
}
function TimeGrid({
  days,
  visibleDays,
  cursor,
  onDateChange,
  byDay,
  now,
  onPick,
  onCompose,
  dropProps,
}: {
  days: Date[];
  visibleDays: number;
  cursor: Date;
  onDateChange: (date: Date) => void;
  byDay: Map<string, CalEvent[]>;
  now: Date;
  onPick: (event: CalEvent) => void;
  onCompose?: (day: string, minute: number, endMinute?: number) => void;
  dropProps: (day: string) => {
    onDragOver: (event: DragEvent) => void;
    onDragLeave: (event: DragEvent) => void;
    onDrop: (event: DragEvent) => void;
  };
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [dayWidth, setDayWidth] = useState(100);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLeft = useRef(0);
  const cursorKey = dateKey(cursor);
  const bufferKey = dateKey(days[0]);
  useLayoutEffect(() => {
    const node = scroller.current;
    if (!node) return;
    const measure = () => {
      if (node.clientWidth > 60) setDayWidth((node.clientWidth - 60) / visibleDays);
    };
    measure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(node);
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, [visibleDays]);
  useLayoutEffect(() => {
    const node = scroller.current;
    if (!node) return;
    const index = days.findIndex((date) => dateKey(date) === cursorKey);
    if (index < 0) return;
    // Recenter only after settling or explicit date navigation. Stable day keys
    // preserve mounted events and vertical scroll position across recentering.
    if (settleTimer.current) clearTimeout(settleTimer.current);
    const left = index * dayWidth;
    if (Math.abs(node.scrollLeft - left) > 1) node.scrollLeft = left;
    lastLeft.current = node.scrollLeft;
  }, [cursorKey, bufferKey, dayWidth, visibleDays]);
  useEffect(() => () => { if (settleTimer.current) clearTimeout(settleTimer.current); }, []);
  function onDateScroll() {
    const node = scroller.current;
    if (!node || Math.abs(node.scrollLeft - lastLeft.current) < .1) return;
    lastLeft.current = node.scrollLeft;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const index = Math.max(0, Math.min(days.length - visibleDays, Math.round(node.scrollLeft / dayWidth)));
      // CSS performs the animated snap. Commit only once the strip has aligned,
      // so the header and buffer never jump during touch/trackpad momentum.
      if (Math.abs(node.scrollLeft - index * dayWidth) > 1) {
        node.scrollTo({ left: index * dayWidth, behavior: "smooth" });
        return;
      }
      if (dateKey(days[index]) !== cursorKey) onDateChange(days[index]);
    }, 160);
  }
  const touch = useRef<{ x: number; y: number; pointer: number } | null>(null);
  const [selection, setSelection] = useState<{
    day: string;
    anchor: number;
    current: number;
  } | null>(null);
  const gesture = useRef<{
    day: string;
    anchor: number;
    current: number;
    pointer: number;
  } | null>(null);
  const minuteAt = (clientY: number, element: HTMLElement) =>
    Math.max(
      0,
      Math.min(
        1440,
        ((clientY - element.getBoundingClientRect().top) / HOUR_PX) * 60,
      ),
    );
  const timeLabel = (minute: number) => {
    const date = new Date(2000, 0, 1);
    date.setMinutes(minute);
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        gesture.current = null;
        setSelection(null);
      }
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, []);
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 7 * HOUR_PX;
  }, []);
  const placed = useMemo(
    () =>
      new Map(
        days.map((date) => [
          dateKey(date),
          layoutDay(byDay.get(dateKey(date)) ?? [], date),
        ]),
      ),
    [days, byDay],
  );
  const columns = {
    gridTemplateColumns: `60px repeat(${days.length}, ${dayWidth}px)`,
    width: 60 + days.length * dayWidth,
  };
  const today = dateKey(now),
    nowTop = (now.getHours() + now.getMinutes() / 60) * HOUR_PX;
  return (
    <div className={`time-grid ${visibleDays === 1 ? "single-day" : ""}`}>
      <div className="time-grid-scroller" ref={scroller} onScroll={onDateScroll} tabIndex={0} aria-label="Scrollable calendar">
      <div className="time-grid-header" style={columns}>
        <div className="time-gutter">
          {now
            .toLocaleTimeString("en", { timeZoneName: "short" })
            .split(" ")
            .pop()}
        </div>
        {days.map((date) => (
          <div
            key={dateKey(date)}
            className={`time-day-heading ${dateKey(date) === today ? "today" : ""}`}
          >
            <span>{DOW[date.getDay()]}</span>
            <b>{date.getDate()}</b>
          </div>
        ))}
      </div>
      <div className="time-grid-allday" style={columns}>
        <span className="time-gutter">All day</span>
        {days.map((date) => (
          <div
            key={dateKey(date)}
            className="allday-cell"
            {...dropProps(dateKey(date))}
          >
            {(byDay.get(dateKey(date)) ?? [])
              .filter((event) => event.allDay)
              .map((event) => (
                <EventChip
                  key={eventKey(event)}
                  event={event}
                  onPick={onPick}
                />
              ))}
          </div>
        ))}
      </div>
        <div
          className="time-grid-body"
          style={{ ...columns, height: HOUR_PX * 24 }}
        >
          <div className="time-hours">
            {Array.from({ length: 24 }, (_, hour) => (
              <div key={hour} style={{ height: HOUR_PX }}>
                <span>{hour ? fmtHour(hour) : ""}</span>
              </div>
            ))}
          </div>
          {days.map((date) => (
            <div
              className={`time-day-column ${dateKey(date) === today ? "today" : ""}`}
              key={dateKey(date)}
              style={{ backgroundSize: `100% ${HOUR_PX}px` }}
              {...dropProps(dateKey(date))}
              onPointerDown={(event) => {
                if (
                  !onCompose ||
                  event.button !== 0 ||
                  (event.target as HTMLElement).closest(".time-event-wrap")
                )
                  return;
                if (event.pointerType === "touch") {
                  touch.current = {
                    x: event.clientX,
                    y: event.clientY,
                    pointer: event.pointerId,
                  };
                  return;
                }
                const anchor = Math.min(
                  1425,
                  Math.floor(
                    minuteAt(event.clientY, event.currentTarget) / 15,
                  ) * 15,
                );
                gesture.current = {
                  day: dateKey(date),
                  anchor,
                  current: anchor + 30,
                  pointer: event.pointerId,
                };
                setSelection(gesture.current);
                event.currentTarget.setPointerCapture(event.pointerId);
                event.preventDefault();
              }}
              onPointerMove={(event) => {
                if (
                  !gesture.current ||
                  gesture.current.pointer !== event.pointerId
                )
                  return;
                gesture.current = {
                  ...gesture.current,
                  current: minuteAt(event.clientY, event.currentTarget),
                };
                setSelection(gesture.current);
                const bounds = scroller.current?.getBoundingClientRect();
                if (bounds && scroller.current) {
                  if (event.clientY > bounds.bottom - 36)
                    scroller.current.scrollTop += 12;
                  else if (event.clientY < bounds.top + 36)
                    scroller.current.scrollTop -= 12;
                }
              }}
              onPointerUp={(event) => {
                if (event.pointerType === "touch") {
                  const start = touch.current;
                  touch.current = null;
                  if (
                    start?.pointer === event.pointerId &&
                    Math.hypot(
                      event.clientX - start.x,
                      event.clientY - start.y,
                    ) < 10
                  )
                    onCompose?.(
                      dateKey(date),
                      Math.min(
                        1410,
                        Math.floor(
                          minuteAt(event.clientY, event.currentTarget) / 15,
                        ) * 15,
                      ),
                    );
                  return;
                }
                const active = gesture.current;
                if (!active || active.pointer !== event.pointerId) return;
                gesture.current = null;
                setSelection(null);
                if (event.currentTarget.hasPointerCapture(event.pointerId))
                  event.currentTarget.releasePointerCapture(event.pointerId);
                const range = selectionRange(active.anchor, active.current);
                onCompose?.(active.day, range.start, range.end);
              }}
              onPointerCancel={() => {
                touch.current = null;
                gesture.current = null;
                setSelection(null);
              }}
              onLostPointerCapture={() => {
                gesture.current = null;
                setSelection(null);
              }}
            >
              {onCompose &&
                Array.from({ length: 48 }, (_, slot) => (
                  <button
                    key={slot}
                    className="time-slot"
                    tabIndex={-1}
                    aria-label={`New event ${dateKey(date)} ${fmtHour(Math.floor(slot / 2))}${slot % 2 ? ", 30 minutes" : ""}`}
                    style={{ top: (slot * HOUR_PX) / 2, height: HOUR_PX / 2 }}
                    onClick={(event) => {
                      if (event.detail === 0)
                        onCompose(dateKey(date), slot * 30);
                    }}
                  >
                    <Icon name="plus" size={14} />
                  </button>
                ))}
              {(placed.get(dateKey(date)) ?? []).map(
                ({ event, top, height, lane, lanes }) => (
                  <div
                    className="time-event-wrap"
                    key={eventKey(event)}
                    style={{
                      top,
                      height,
                      left: `calc(${(lane / lanes) * 100}% + 3px)`,
                      width: `calc(${100 / lanes}% - 6px)`,
                    }}
                  >
                    <button
                      className={`time-event source-${event.provider}`}
                      onClick={() => onPick(event)}
                      title={`${event.title} · ${fmtTime(event.start)}–${fmtTime(event.end)}`}
                      style={eventStyle(event)}
                    >
                      <strong>{event.title}</strong>
                      <span>
                        {fmtTime(event.start)} – {fmtTime(event.end)}
                      </span>
                      {height > 70 && event.location && (
                        <small>{event.location}</small>
                      )}
                    </button>
                    <QuickJoin event={event} />
                  </div>
                ),
              )}
              {selection?.day === dateKey(date) &&
                (() => {
                  const range = selectionRange(
                    selection.anchor,
                    selection.current,
                  );
                  return (
                    <div
                      className="time-selection"
                      style={{
                        top: (range.start / 60) * HOUR_PX,
                        height: ((range.end - range.start) / 60) * HOUR_PX,
                      }}
                    >
                      <strong>New event</strong>
                      <span>
                        {timeLabel(range.start)} – {timeLabel(range.end)}
                      </span>
                    </div>
                  );
                })()}
              {dateKey(date) === today && (
                <div className="time-now" style={{ top: nowTop }}>
                  <span />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function Agenda({
  byDay,
  today,
  onPick,
}: {
  byDay: Map<string, CalEvent[]>;
  today: string;
  onPick: (event: CalEvent) => void;
}) {
  const entries = [...byDay.entries()].filter(([, events]) => events.length);
  if (!entries.length)
    return (
      <div className="workspace-empty">
        <div className="empty-symbol">
          <Icon name="calendar" size={28} />
        </div>
        <h3>No events</h3>
        <p>
          No events in this range. Try another date or add a deadline to a task.
        </p>
      </div>
    );
  return (
    <div className="calendar-agenda">
      {entries.map(([day, events]) => (
        <div className="agenda-day" key={day}>
          <div className={`agenda-date ${day === today ? "today" : ""}`}>
            <b>{new Date(`${day}T12:00:00`).getDate()}</b>
            <span>
              {new Date(`${day}T12:00:00`).toLocaleDateString([], {
                weekday: "short",
                month: "short",
              })}
            </span>
            {day === today && <small>Today</small>}
          </div>
          <div>
            {events.map((event) => (
              <div className="agenda-event-wrap" key={eventKey(event)}>
                <button
                  className="agenda-event"
                  onClick={() => onPick(event)}
                  style={eventStyle(event)}
                >
                  <span className="agenda-time">
                    {event.allDay
                      ? "All day"
                      : `${fmtTime(event.start)} – ${fmtTime(event.end)}`}
                  </span>
                  <span>
                    <strong>{event.title}</strong>
                    <small>
                      {PROVIDER_LABEL[event.provider]}
                      {event.location ? ` · ${event.location}` : ""}
                    </small>
                  </span>
                  <Icon name="chevron" size={16} />
                </button>
                <QuickJoin event={event} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
function EventPanel({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const mobile = useMobile();
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (mobile) return;
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, [mobile]);
  if (mobile)
    return (
      <Dialog label={title} className="event-inspector-modal" onClose={onClose}>
        <div className="event-sheet-handle" aria-hidden="true" />
        {children}
      </Dialog>
    );
  return (
    <aside
      ref={panel}
      role="dialog"
      aria-label={title}
      tabIndex={-1}
      className="event-inspector"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      {children}
    </aside>
  );
}

function EventDetail({
  event,
  onClose,
  openTask,
  onDelete,
  onColorChange,
}: {
  event: CalEvent;
  onClose: () => void;
  openTask: (id: string) => void;
  onDelete: () => Promise<void>;
  onColorChange: (colorId: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [armed, setArmed] = useState(false);
  const mobile = useMobile();
  const meeting = eventMeetingUrl(event);
  const duration = Math.round(
    (new Date(event.end).getTime() - new Date(event.start).getTime()) / 60000,
  );
  const date = new Date(
    event.allDay ? `${event.start.slice(0, 10)}T12:00:00` : event.start,
  );
  const lastDate = new Date(
    event.allDay
      ? `${shiftDate(event.end.slice(0, 10), -1)}T12:00:00`
      : event.end,
  );
  const dateLabel = (value: Date) =>
    value.toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);
  return (
    <EventPanel
      title={event.title}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <header className="event-inspector-heading">
        <div className="event-inspector-label">
          <span>Event</span>
          <button
            className="icon-button"
            aria-label="Close event"
            onClick={onClose}
            disabled={busy}
          >
            <Icon name="close" />
          </button>
        </div>
        <h2>{event.title}</h2>
      </header>
      <div className="event-inspector-body">
        <section className="event-inspector-section event-when">
          <Icon name="clock" />
          <div>
            <div className="event-time-range">
              {event.allDay ? (
                "All day"
              ) : (
                <>
                  {fmtTime(event.start)} <Icon name="arrow" size={14} />{" "}
                  {fmtTime(event.end)}{" "}
                  <small>{duration > 0 ? `${duration} min` : ""}</small>
                </>
              )}
            </div>
            <p>
              {dateLabel(date)}
              {dateKey(date) !== dateKey(lastDate)
                ? ` – ${dateLabel(lastDate)}`
                : ""}
            </p>
            {!event.allDay && (
              <small className="event-timezone">
                {Intl.DateTimeFormat()
                  .resolvedOptions()
                  .timeZone.replaceAll("_", " ")}
              </small>
            )}
            {event.recurring && (
              <p className="event-repeat">
                <Icon name="refresh" size={14} /> Repeating event
              </p>
            )}
          </div>
        </section>
        {meeting && (
          <section className="event-inspector-section event-meeting">
            <a
              className="btn btn-primary event-join"
              href={meeting}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="video" /> Join meeting <Icon name="arrow" size={15} />
            </a>
            <a
              className="event-meeting-address"
              href={meeting}
              target="_blank"
              rel="noopener noreferrer"
            >
              {meetingLabel(meeting)} <span>{new URL(meeting).hostname}</span>
            </a>
          </section>
        )}
        <section className="event-inspector-section event-appearance">
          <div className="event-calendar-name">
            <span
              className="event-source-dot"
              style={{ background: event.color || COLORS[event.provider] }}
            />
            {event.calendarName || PROVIDER_LABEL[event.provider]}
          </div>
          <ColorPicker
            value={event.colorId ?? ""}
            disabled={busy}
            hint={
              event.provider === "google" && !event.colorReadOnly
                ? "Syncs to Google. Repeating events: this occurrence only."
                : "Saved in this browser."
            }
            onChange={async (colorId) => {
              setBusy(true);
              setError("");
              try {
                await onColorChange(colorId);
              } catch (err) {
                setError(`Could not save color. ${(err as Error).message}`);
              } finally {
                setBusy(false);
              }
            }}
          />
        </section>
        {(event.location || event.organizer || event.attendees?.length || event.description) ? (
          <details className="event-extra-details" open={!mobile}>
            <summary>Event details</summary>
        {event.location && event.location !== meeting && (
          <section className="event-inspector-section">
            <span className="event-field-label">Location</span>
            <p className="event-location">{event.location}</p>
          </section>
        )}
        {(event.organizer || Boolean(event.attendees?.length)) && (
          <section className="event-inspector-section">
            {event.organizer && (
              <p className="event-organizer">
                <span className="event-field-label">Organizer</span>
                {event.organizer}
              </p>
            )}
            {!!event.attendees?.length && (
              <details className="event-guests">
                <summary>{event.attendees.length} participants</summary>
                <ul>
                  {event.attendees.map((guest, index) => (
                    <li key={`${guest.name}:${index}`}>
                      <span>{guest.name}</span>
                      <small>
                        {guest.response === "accepted"
                          ? "Yes"
                          : guest.response === "declined"
                            ? "No"
                            : guest.response === "tentative" ||
                                guest.response === "tentativelyAccepted"
                              ? "Maybe"
                              : "Awaiting"}
                      </small>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        )}
        {event.description && (
          <details className="event-inspector-section event-description">
            <summary>Description</summary>
            <p>{event.description}</p>
          </details>
        )}
          </details>
        ) : null}
        {error && (
          <div className="banner" role="alert">
            {error}
          </div>
        )}
      </div>
      <footer className="event-inspector-footer">
        {event.link && (
          <a
            className="btn"
            href={event.link}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open calendar <Icon name="arrow" size={14} />
          </a>
        )}
        {event.taskId && (
          <button
            className="btn"
            disabled={busy}
            onClick={() => {
              onClose();
              openTask(event.taskId!);
            }}
          >
            Edit task <Icon name="arrow" size={14} />
          </button>
        )}
        {PROVIDERS.includes(event.provider as ConnectedProvider) && (
          <button
            className={`task-delete ${armed ? "armed" : ""}`}
            disabled={busy}
            onClick={async () => {
              if (!armed) {
                setArmed(true);
                return;
              }
              setBusy(true);
              try {
                await onDelete();
              } catch (err) {
                setError((err as Error).message);
                setBusy(false);
              }
            }}
          >
            {armed ? "Confirm delete" : "Delete event"}
          </button>
        )}
      </footer>
    </EventPanel>
  );
}
function Compose({
  conn,
  initial,
  onClose,
  onCreated,
}: {
  conn: ConnectionState;
  initial: EventSelection;
  onClose: () => void;
  onCreated: (event: CalEvent, colorId: string) => Promise<void>;
}) {
  const providers = PROVIDERS.filter((provider) => conn[provider]);
  const [provider, setProvider] = useState<ConnectedProvider>(providers[0]);
  const [title, setTitle] = useState(""),
    [location, setLocation] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [colorId, setColorId] = useState("");
  const initialDate = new Date(`${initial.day}T00:00:00`);
  initialDate.setMinutes(initial.minute);
  const asInput = (date: Date) =>
    `${dateKey(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  const [start, setStart] = useState(asInput(initialDate));
  const initialEnd = new Date(`${initial.day}T00:00:00`);
  initialEnd.setMinutes(initial.endMinute ?? initial.minute + 60);
  const [end, setEnd] = useState(asInput(initialEnd));
  const [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    if (!title.trim()) {
      setError("Give your event a name.");
      return;
    }
    if (
      !start ||
      !end ||
      (allDay
        ? end.slice(0, 10) < start.slice(0, 10)
        : new Date(end).getTime() <= new Date(start).getTime())
    ) {
      setError("Choose an end after the start.");
      return;
    }
    submitting.current = true;
    setSaving(true);
    setError("");
    try {
      const id = await createEvent({
        provider,
        colorId: provider === "google" ? colorId || undefined : undefined,
        title: title.trim(),
        allDay,
        start: allDay
          ? `${start.slice(0, 10)}T00:00:00Z`
          : new Date(start).toISOString(),
        end: allDay
          ? `${shiftDate(end.slice(0, 10), 1)}T00:00:00Z`
          : new Date(end).toISOString(),
        location: location.trim() || undefined,
      });
      await onCreated(
        {
          id,
          provider,
          calendarId: "primary",
          title: title.trim(),
          start,
          end,
          allDay,
        },
        colorId,
      );
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
      submitting.current = false;
    }
  }
  return (
    <Dialog
      label="New calendar event"
      className="calendar-compose-dialog"
      onClose={() => {
        if (!saving) onClose();
      }}
    >
      <form onSubmit={submit}>
        <div className="modal-h editor-heading">
          <div>
            <h2>New event</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close new event"
            disabled={saving}
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body task-editor">
          <label>
            Event name
            <input
              required
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="What’s on your calendar?"
            />
          </label>
          <label>
            Calendar
            <select
              value={provider}
              onChange={(event) =>
                setProvider(event.target.value as ConnectedProvider)
              }
            >
              {providers.map((value) => (
                <option key={value} value={value}>
                  {PROVIDER_LABEL[value]}
                </option>
              ))}
            </select>
          </label>
          <ColorPicker
            value={colorId}
            onChange={setColorId}
            disabled={saving}
            hint={
              provider === "google"
                ? "Syncs to Google Calendar."
                : "Saved in this browser."
            }
          />
          <label className="cal-check">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(event) => setAllDay(event.target.checked)}
            />
            All day
          </label>
          <div className="editor-fields">
            <label>
              Starts
              <input
                required
                type={allDay ? "date" : "datetime-local"}
                value={allDay ? start.slice(0, 10) : start}
                onChange={(event) =>
                  setStart(
                    allDay ? `${event.target.value}T00:00` : event.target.value,
                  )
                }
              />
            </label>
            <label>
              Ends
              <input
                required
                type={allDay ? "date" : "datetime-local"}
                value={allDay ? end.slice(0, 10) : end}
                onChange={(event) =>
                  setEnd(
                    allDay ? `${event.target.value}T00:00` : event.target.value,
                  )
                }
              />
            </label>
          </div>
          <p className="field-hint">
            {allDay
              ? "Includes the end date."
              : `Times in ${Intl.DateTimeFormat().resolvedOptions().timeZone.replaceAll("_", " ")}.`}
          </p>
          <label>
            <span>Location <span className="muted">(optional)</span></span>
            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Add a location or meeting link"
            />
          </label>
          {error && (
            <div className="banner" role="alert">
              {error}
            </div>
          )}
        </div>
        <div className="modal-foot">
          <span className="spacer" />
          <button
            type="button"
            className="btn"
            disabled={saving}
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="btn btn-primary" disabled={saving}>
            {saving ? "Creating…" : "Create event"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function ColorPicker({
  value,
  onChange,
  disabled,
  hint,
}: {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  hint: string;
}) {
  const [open, setOpen] = useState(false);
  const picker = useRef<HTMLDivElement>(null);
  const id = useId();
  const name =
    EVENT_COLORS.find((color) => color.id === value)?.name ??
    "Calendar default";
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!picker.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  function choose(id: string) {
    setOpen(false);
    picker.current
      ?.querySelector<HTMLButtonElement>(".event-color-trigger")
      ?.focus();
    onChange(id);
  }
  return (
    <div
      className="event-color-picker compact-color-picker"
      ref={picker}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
          picker.current
            ?.querySelector<HTMLButtonElement>(".event-color-trigger")
            ?.focus();
        }
      }}
    >
      <button
        type="button"
        className="event-color-trigger"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <span
          className="event-source-dot"
          style={{ background: colorHex(value) || "var(--muted)" }}
        />
        <span>Event color</span>
        <small>{disabled ? "Saving…" : name}</small>
        <Icon name="chevron" size={12} />
      </button>
      {open && (
        <fieldset className="event-color-popover" id={id} disabled={disabled}>
          <legend className="sr-only">Choose event color</legend>
          <button
            type="button"
            className="event-color-default"
            aria-pressed={!value}
            onClick={() => choose("")}
          >
            Calendar default {!value && <Icon name="check" size={12} />}
          </button>
          <div className="event-color-options">
            {EVENT_COLORS.map((color) => (
              <button
                key={color.id}
                type="button"
                className="event-color-swatch"
                aria-label={color.name}
                title={color.name}
                aria-pressed={value === color.id}
                style={{ "--swatch": color.hex } as CSSProperties}
                onClick={() => choose(color.id)}
              >
                <span>
                  {value === color.id && <Icon name="check" size={12} />}
                </span>
              </button>
            ))}
          </div>
          <p className="field-hint">{hint}</p>
        </fieldset>
      )}
    </div>
  );
}

function QuickJoin({ event }: { event: CalEvent }) {
  const url = eventMeetingUrl(event);
  if (!url) return null;
  return (
    <a
      className="calendar-quick-join"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Join meeting: ${event.title}`}
      title={`Join ${meetingLabel(url)}`}
    >
      <Icon name="video" size={14} />
    </a>
  );
}
