"use client";

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import type { Task, TaskPriority, TaskStatus } from "@/lib/types";
import { projectColor } from "@/lib/categories";
import { todayISO } from "@/lib/day";
import { dueLabel, shiftDate } from "@/lib/task-dates";
import type { useTaskWorkspace } from "@/lib/useTaskWorkspace";
import { Markdown } from "@/lib/markdown";
import { Icon } from "./Icon";
import { Dialog } from "./Dialog";
import { useMobile } from "@/lib/useMobile";

type Focus = { id: string; n: number } | null;
type Filter = "all" | "today" | "upcoming" | "overdue" | "undated" | "done" | "planned" | "unplanned";
type Workspace = ReturnType<typeof useTaskWorkspace>;
const STATUS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Completed",
};
const FILTERS: [Filter, string][] = [
  ["all", "All tasks"],
  ["today", "Today"],
  ["upcoming", "Upcoming"],
  ["overdue", "Overdue"],
  ["undated", "No date"],
  ["planned", "Planned"],
  ["unplanned", "Unplanned"],
  ["done", "Completed"],
];

function estimateLabel(minutes: number) {
  if (!minutes) return "";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return [hours ? `${hours}h` : "", rest ? `${rest}m` : ""].filter(Boolean).join(" ");
}

export function TasksTab({
  workspace,
  openWiki,
  openCalendar,
  onAgentTimebox,
  focus,
  compact = false,
}: {
  workspace: Workspace;
  openWiki: (slug: string) => void;
  openCalendar: () => void;
  onAgentTimebox: () => void;
  focus?: Focus;
  compact?: boolean;
}) {
  const { tasks, pending, save, add, remove } = workspace;
  const mobile = useMobile();
  const [headerHost, setHeaderHost] = useState<HTMLElement | null>(null);
  useEffect(() => { setHeaderHost(mobile ? document.getElementById("workspace-phone-actions") : null); }, [mobile]);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>(compact ? "today" : "all");
  const [query, setQuery] = useState("");
  const search = useDeferredValue(query.trim().toLowerCase());
  const [layout, setLayout] = useState<"list" | "board">("list");
  const [sort, setSort] = useState<"date" | "priority">("date");
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [error, setError] = useState("");
  const today = todayISO();
  const open = tasks.filter((task) => task.status !== "done");
  const completed = tasks.length - open.length;
  const dueToday = open.filter((task) => task.due_date === today).length;
  const overdue = open.filter(
    (task) => task.due_date && task.due_date < today,
  ).length;
  const pct = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  const projects = useMemo(
    () =>
      [
        ...new Set([
          "research",
          "academics",
          "personal",
          ...tasks.map((task) => task.project),
        ]),
      ]
        .filter(Boolean)
        .sort(),
    [tasks],
  );
  useEffect(() => {
    if (focus) setEditing(focus.id);
  }, [focus]);
  const activeTask = tasks.find((task) => task.id === editing);
  const counts: Record<Filter, number> = {
    all: layout === "board" ? tasks.length : open.length,
    today: dueToday,
    overdue,
    done: completed,
    planned: open.filter(task => Boolean(task.timebox_start)).length,
    unplanned: open.filter(task => !task.timebox_start).length,
    upcoming: open.filter((task) => task.due_date > today).length,
    undated: open.filter((task) => !task.due_date).length,
  };
  const filtered = useMemo(() => {
    const rank = { high: 0, medium: 1, low: 2 };
    return tasks
      .filter((task) => {
        if (
          filter === "done"
            ? task.status !== "done"
            : task.status === "done" &&
              !(layout === "board" && filter === "all")
        )
          return false;
        if (filter === "planned" && !task.timebox_start) return false;
        if (filter === "unplanned" && task.timebox_start) return false;
        if (filter === "today" && task.due_date !== today) return false;
        if (filter === "upcoming" && task.due_date <= today) return false;
        if (filter === "overdue" && (!task.due_date || task.due_date >= today))
          return false;
        if (filter === "undated" && task.due_date) return false;
        return (
          !search ||
          `${task.title} ${task.project} ${task.tags.join(" ")}`
            .toLowerCase()
            .includes(search)
        );
      })
      .sort((a, b) => {
        const date = (a.due_date || "9999").localeCompare(b.due_date || "9999");
        const priority = rank[a.priority] - rank[b.priority];
        return (
          (sort === "date" ? date || priority : priority || date) ||
          a.title.localeCompare(b.title)
        );
      });
  }, [tasks, filter, search, today, sort, layout]);
  const groups = useMemo(() => {
    const map = new Map<string, Task[]>();
    if (layout === "board") {
      for (const status of ["todo", "in_progress", "done"] as TaskStatus[])
        map.set(
          STATUS[status],
          filtered.filter((task) => task.status === status),
        );
    } else {
      for (const task of filtered) {
        const group = task.project || "unsorted";
        map.set(group, [...(map.get(group) ?? []), task]);
      }
    }
    return [...map.entries()];
  }, [filtered, layout]);
  async function toggle(task: Task) {
    setError("");
    try {
      await save(task, { status: task.status === "done" ? "todo" : "done" });
    } catch (err) {
      setError((err as Error).message);
    }
  }
  return (
    <section className="tasks-workspace">
      {mobile && headerHost && createPortal(<button className="task-phone-add task-header-add" aria-label="New task" title="New task" onClick={() => setEditing("new")}><Icon name="plus" size={22} /></button>, headerHost)}
      {!mobile && <>
      <div className="page-heading">
        <div>
          <h1>Tasks</h1>
        </div>
        <div className="task-heading-actions">
          <button
            className="btn agent-timebox-button"
            onClick={onAgentTimebox}
            disabled={!open.length}
            title="Ask Codex to estimate and place your open tasks on the calendar"
          >
            <Icon name="clock" /> <span>Plan with Codex</span>
          </button>
          <button className="btn btn-primary" onClick={() => setEditing("new")}>
            <Icon name="plus" /> New task
          </button>
        </div>
      </div>
      <div className="task-insights">
        <button
          onClick={() => setFilter("all")}
          className={filter === "all" ? "selected" : ""}
        >
          <Icon name="tasks" />
          <span>
            <b>{open.length}</b>
            <small>Open tasks</small>
          </span>
        </button>
        <button
          onClick={() => setFilter("today")}
          className={filter === "today" ? "selected" : ""}
        >
          <Icon name="today" />
          <span>
            <b>{dueToday}</b>
            <small>Due today</small>
          </span>
        </button>
        <button
          onClick={() => setFilter("overdue")}
          className={filter === "overdue" ? "selected" : ""}
        >
          <Icon name="clock" />
          <span>
            <b className={overdue ? "text-danger" : ""}>{overdue}</b>
            <small>Overdue</small>
          </span>
        </button>
        <button
          onClick={() => setFilter("done")}
          className={filter === "done" ? "selected" : ""}
        >
          <div
            className="completion-ring"
            style={{
              background: `conic-gradient(var(--accent) ${pct}%, var(--rule) 0)`,
            }}
          >
            <span>{pct}%</span>
          </div>
          <span>
            <b>{completed}</b>
            <small>Completed</small>
          </span>
        </button>
      </div>
      <div className="workspace-toolbar">
        <label className="workspace-search">
          <Icon name="search" />
          <input
            aria-label="Search tasks"
            placeholder="Search your tasks…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="toolbar-actions">
          <label className="sort-control">
            <span>Sort by</span>
            <select
              aria-label="Sort tasks"
              value={sort}
              onChange={(event) => setSort(event.target.value as typeof sort)}
            >
              <option value="date">Due date</option>
              <option value="priority">Priority</option>
            </select>
          </label>
          <div className="seg view-switch">
            <button
              className={`seg-btn ${layout === "list" ? "active" : ""}`}
              aria-label="List view"
              aria-pressed={layout === "list"}
              onClick={() => setLayout("list")}
            >
              <Icon name="list" />
            </button>
            <button
              className={`seg-btn ${layout === "board" ? "active" : ""}`}
              aria-label="Board view"
              aria-pressed={layout === "board"}
              onClick={() => setLayout("board")}
            >
              <Icon name="board" />
            </button>
          </div>
        </div>
      </div>
      <div className="task-filters" aria-label="Filter tasks">
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            aria-pressed={filter === key}
            className={filter === key ? "active" : ""}
            onClick={() => setFilter(key)}
          >
            {label}
            <span>{counts[key]}</span>
          </button>
        ))}
        <button className="task-calendar-link" onClick={openCalendar}>
          <Icon name="calendar" /> Calendar <Icon name="arrow" size={14} />
        </button>
      </div>
      </>}
      {mobile && <div className="task-phone-controls">
        <div className="task-phone-bar">
          <select aria-label="Filter tasks" value={filter} onChange={event => setFilter(event.target.value as Filter)}>{FILTERS.map(([key, label]) => <option key={key} value={key}>{label} · {counts[key]}</option>)}</select>
          <button className="icon-button" aria-label="Search tasks" aria-expanded={searchOpen} onClick={() => { setSearchOpen(!searchOpen); if (searchOpen) setQuery(""); }}><Icon name="search" size={19} /></button>
          <button className="icon-button" aria-label="Task options" onClick={() => setOptionsOpen(true)}><Icon name="settings" size={19} /></button>
          {!headerHost && <button className="task-phone-add" aria-label="New task" onClick={() => setEditing("new")}><Icon name="plus" size={22} /></button>}
        </div>
        {searchOpen && <label className="workspace-search task-phone-search"><Icon name="search" size={18} /><input autoFocus aria-label="Search tasks" placeholder="Search tasks…" value={query} onChange={event => setQuery(event.target.value)} /></label>}
      </div>}
      {optionsOpen && <Dialog label="Task options" className="task-options-sheet" onClose={() => setOptionsOpen(false)}>
        <div className="agent-context-heading"><h2>Task options</h2><button className="icon-button" aria-label="Close task options" onClick={() => setOptionsOpen(false)}><Icon name="close" size={18} /></button></div>
        <label className="task-option-row"><span>Sort by</span><select aria-label="Sort tasks" value={sort} onChange={event => setSort(event.target.value as typeof sort)}><option value="date">Due date</option><option value="priority">Priority</option></select></label>
        <label className="task-option-row"><span>View</span><select aria-label="Task layout" value={layout} onChange={event => setLayout(event.target.value as typeof layout)}><option value="list">List</option><option value="board">Board</option></select></label>
        <button className="task-option-action" disabled={!open.length} onClick={() => { setOptionsOpen(false); onAgentTimebox(); }}><Icon name="clock" size={20} />Plan with Codex<Icon name="arrow" size={16} /></button>
        <button className="task-option-action" onClick={() => { setOptionsOpen(false); openCalendar(); }}><Icon name="calendar" size={20} />Open calendar<Icon name="arrow" size={16} /></button>
        <button className="btn btn-primary" onClick={() => setOptionsOpen(false)}>Done</button>
      </Dialog>}
      {error && (
        <div className="banner" role="alert">
          {error}
        </div>
      )}
      {filtered.length === 0 ? (
        <div className="workspace-empty">
          <div className="empty-symbol">
            <Icon name={filter === "done" ? "check" : "tasks"} size={28} />
          </div>
          <h3>
            {search
              ? "No matching tasks"
              : filter === "overdue"
                ? "No overdue tasks"
                : "No tasks in this view"}
          </h3>
          <p>
            {search
              ? "Try another title or project name."
              : filter === "overdue"
                ? "Choose another filter to see your tasks."
                : "Add a task or choose another filter."}
          </p>
          <button
            className="btn"
            onClick={() => (search ? setQuery("") : setEditing("new"))}
          >
            {search ? "Clear search" : "Add a task"}
          </button>
        </div>
      ) : (
        <div
          className={`task-groups ${layout === "board" ? "task-board" : ""}`}
          key={layout}
        >
          {groups.map(([name, items]) => (
            <section className="task-group" key={name}>
              <div className="task-group-heading">
                <span
                  className="project-dot"
                  style={{ background: projectColor(name) || "var(--accent)" }}
                />
                <h2>{name.replaceAll("-", " ")}</h2>
                <span className="count-badge">{items.length}</span>
              </div>
              {layout === "list" && (
                <div className="task-table-labels">
                  <span>Task</span>
                  <span>Priority</span>
                  <span>Status</span>
                  <span>Due date</span>
                </div>
              )}
              <div className="task-group-rows">
                {items.map((task) => (
                  <div
                    className={`task-item ${task.status === "done" ? "is-done" : ""}`}
                    key={task.id}
                  >
                    <label className="task-checkbox">
                      <input
                        type="checkbox"
                        checked={task.status === "done"}
                        disabled={pending.has(task.id)}
                        onChange={() => void toggle(task)}
                        aria-label={`Mark ${task.title} ${task.status === "done" ? "incomplete" : "complete"}`}
                      />
                      <span>
                        <Icon name="check" size={13} />
                      </span>
                    </label>
                    <button
                      className="task-name"
                      onClick={() => setEditing(task.id)}
                    >
                      <span>{task.title}</span>
                      <small className="task-estimate" title={task.timebox_start ? new Date(task.timebox_start).toLocaleString() : "No calendar block scheduled"}>{task.timebox_start ? "Planned" : "Unplanned"}</small>
                      {(layout === "board" || task.estimate_minutes > 0) && (
                        <small className="task-estimate">
                          {layout === "board" && task.project.replaceAll("-", " ")}
                          {layout === "board" && task.estimate_minutes > 0 && " · "}
                          {task.estimate_minutes > 0 && `${estimateLabel(task.estimate_minutes)} estimated`}
                        </small>
                      )}
                    </button>
                    <span className={`task-priority prio-${task.priority}`}>
                      <Icon name="flag" size={12} />
                      {task.priority}
                    </span>
                    <span className={`task-status status-${task.status}`}>
                      <i />
                      {STATUS[task.status]}
                    </span>
                    <button
                      className={`task-date-button ${task.due_date && task.due_date < today && task.status !== "done" ? "overdue" : ""} ${task.due_date === today ? "due-today" : ""}`}
                      onClick={() => setEditing(task.id)}
                      aria-label={`Edit due date for ${task.title}`}
                    >
                      <Icon name="calendar" size={14} />
                      {dueLabel(task.due_date, today)}
                    </button>
                  </div>
                ))}
              </div>
              {items.length === 0 && (
                <p className="board-empty">Nothing here yet.</p>
              )}
            </section>
          ))}
        </div>
      )}
      <div className="task-footer">
        <span>
          {filtered.length}{" "}
          {filter === "done"
            ? "completed "
            : layout === "board" && filter === "all"
              ? ""
              : "open "}
          task
          {filtered.length === 1 ? "" : "s"}
          {search ? " matching your search" : " in this view"}
        </span>
        <span>Click a task to edit its details</span>
      </div>
      {editing && (editing === "new" || activeTask) && (
        <TaskEditor
          key={editing}
          task={activeTask}
          projects={projects}
          onClose={() => setEditing(null)}
          onSave={async (values) => {
            if (activeTask) await save(activeTask, values);
            else await add(values);
            setEditing(null);
          }}
          onDelete={
            activeTask
              ? async () => {
                  await remove(activeTask);
                  setEditing(null);
                }
              : undefined
          }
          openWiki={openWiki}
          busy={!!activeTask && pending.has(activeTask.id)}
        />
      )}
    </section>
  );
}

function TaskEditor({
  task,
  projects,
  onClose,
  onSave,
  onDelete,
  openWiki,
  busy,
}: {
  task?: Task;
  projects: string[];
  onClose: () => void;
  onSave: (values: {
    title: string;
    project: string;
    due_date: string;
    priority: TaskPriority;
    status: TaskStatus;
    body?: string;
    estimate_minutes?: number;
  }) => Promise<void>;
  onDelete?: () => Promise<void>;
  openWiki: (slug: string) => void;
  busy: boolean;
}) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [project, setProject] = useState(task?.project ?? "");
  const [due, setDue] = useState(task?.due_date ?? "");
  const [priority, setPriority] = useState<TaskPriority>(
    task?.priority ?? "medium",
  );
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "todo");
  const [body, setBody] = useState(task?.body ?? "");
  const [estimate, setEstimate] = useState(task?.estimate_minutes ? String(task.estimate_minutes) : "");
  const [notesEdit, setNotesEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState("");
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current || busy) return;
    submitting.current = true;
    setSaving(true);
    setError("");
    try {
      await onSave({
        title: title.trim(),
        project: project.trim() || "unsorted",
        due_date: due,
        priority,
        status,
        estimate_minutes: estimate ? Number(estimate) : 0,
        ...(task ? { body } : {}),
      });
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
      submitting.current = false;
    }
  }
  return (
    <Dialog
      label={task ? "Edit task" : "New task"}
      onClose={() => {
        if (!saving) onClose();
      }}
    >
      <form onSubmit={submit}>
        <div className="modal-h editor-heading">
          <div>
            <h2>{task ? "Task details" : "New task"}</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Close task editor"
            onClick={onClose}
            disabled={saving}
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body task-editor">
          <label>
            Task name
            <input
              autoFocus
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="What would you like to get done?"
            />
          </label>
          <div className="editor-fields">
            <label>
              <span>
                <Icon name="calendar" size={15} /> Due date
              </span>
              <input
                type="date"
                value={due}
                onChange={(event) => setDue(event.target.value)}
              />
            </label>
            <label>
              Project
              <input
                list="task-projects"
                value={project}
                onChange={(event) => setProject(event.target.value)}
                placeholder="Choose or create a project"
              />
              <datalist id="task-projects">
                {projects.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </label>
          </div>
          <div className="date-shortcuts">
            {[
              ["Today", 0],
              ["Tomorrow", 1],
              ["Next week", 7],
            ].map(([label, days]) => (
              <button
                type="button"
                key={label}
                className={
                  due === shiftDate(todayISO(), Number(days)) ? "active" : ""
                }
                onClick={() => setDue(shiftDate(todayISO(), Number(days)))}
              >
                {label}
              </button>
            ))}
            {due && (
              <button type="button" onClick={() => setDue("")}>
                Clear date
              </button>
            )}
          </div>
          <div className="editor-fields">
            <label>
              Priority
              <select
                value={priority}
                onChange={(event) =>
                  setPriority(event.target.value as TaskPriority)
                }
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            {task && (
              <label>
                Status
                <select
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as TaskStatus)
                  }
                >
                  {Object.entries(STATUS).map(([key, name]) => (
                    <option key={key} value={key}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <label>
            <span>
              <Icon name="clock" size={15} /> Estimated time
            </span>
            <input
              type="number"
              min={0}
              max={480}
              step={15}
              value={estimate}
              onChange={(event) => setEstimate(event.target.value)}
              placeholder="Leave blank for Codex to estimate"
            />
            <small className="field-hint">
              Minutes of focused work. Codex can update this when it plans your tasks.
            </small>
          </label>
          {task && (
            <div className="task-notes">
              <div className="task-notes-heading">
                <span>Notes</span>
                <button
                  type="button"
                  className="inline-link"
                  onClick={() => setNotesEdit(!notesEdit)}
                >
                  {notesEdit ? "Preview" : "Edit notes"}
                </button>
              </div>
              {notesEdit ? (
                <textarea
                  aria-label="Task notes"
                  rows={5}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                />
              ) : body ? (
                <Markdown
                  body={body}
                  onNavigate={(slug) => {
                    onClose();
                    openWiki(slug);
                  }}
                />
              ) : (
                <p className="muted">
                  Add a little context for your future self.
                </p>
              )}
            </div>
          )}
          {task?.page_slug && (
            <button
              type="button"
              className="inline-link"
              onClick={() => {
                onClose();
                openWiki(task.page_slug);
              }}
            >
              Open linked wiki page <Icon name="arrow" size={14} />
            </button>
          )}
          {error && (
            <div className="banner" role="alert">
              {error}
            </div>
          )}
        </div>
        <div className="modal-foot">
          {onDelete && (
            <button
              type="button"
              className={`task-delete ${armed ? "armed" : ""}`}
              disabled={saving || busy}
              onClick={async () => {
                if (!armed) {
                  setArmed(true);
                  return;
                }
                setSaving(true);
                try {
                  await onDelete();
                } catch (err) {
                  setSaving(false);
                  setError((err as Error).message);
                }
              }}
            >
              {armed ? "Confirm delete" : "Delete task"}
            </button>
          )}
          <span className="spacer" />
          <button
            type="button"
            className="btn"
            disabled={saving}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={saving || busy || !title.trim()}
          >
            {saving ? "Saving…" : task ? "Save changes" : "Create task"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
