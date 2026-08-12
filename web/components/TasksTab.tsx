"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Task, TaskStatus } from "@/lib/types";
import { projectColor } from "@/lib/categories";
import { Markdown } from "@/lib/markdown";
import { createTask, updateTask } from "@/lib/clientapi";
import { todayISO } from "@/lib/day";
import { taskStats } from "@/lib/stats";

type Focus = { id: string; n: number } | null;
type StatusFilter = "all" | "todo" | "in_progress";

function isOverdue(due: string, status: TaskStatus): boolean {
  if (!due || status === "done") return false;
  return due < todayISO(); // compare against today in New York time
}

export function TasksTab({
  tasks: initial,
  openWiki,
  focus,
}: {
  tasks: Task[];
  openWiki: (slug: string) => void;
  focus?: Focus;
}) {
  // Seeded from the build-time snapshot; mutations update this local copy
  // optimistically (the committed change also shows after the next redeploy).
  const [tasks, setTasks] = useState<Task[]>(initial);
  // Don't let a re-seed from the build-time snapshot clobber an edit that's
  // still committing — that was part of the checkbox "flicker back".
  const pending = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (pending.current.size === 0) setTasks(initial);
  }, [initial]);

  const [showDone, setShowDone] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [title, setTitle] = useState("");
  const [project, setProject] = useState(""); // "" = unsorted, "__new__" = adding
  const [newProject, setNewProject] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const stats = useMemo(() => taskStats(tasks, todayISO()), [tasks]);

  // Existing projects for the picker (from current tasks), always offering the
  // common life areas even when empty.
  const projects = useMemo(() => {
    const set = new Set<string>(["example-project", "research", "academics", "personal"]);
    for (const t of tasks) if (t.project) set.add(t.project);
    set.delete("unsorted");
    return [...set].sort();
  }, [tasks]);

  // Deep-link from search/Overview: reveal the task (expand + scroll), and
  // flip on "done" view if it's a completed task.
  useEffect(() => {
    if (!focus) return;
    const t = tasks.find((x) => x.id === focus.id);
    if (t?.status === "done") setShowDone(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  function replace(t: Task) {
    setTasks((cur) => cur.map((x) => (x.id === t.id ? t : x)));
  }

  async function toggle(t: Task, done: boolean) {
    const optimistic = { ...t, status: (done ? "done" : "todo") as TaskStatus };
    replace(optimistic);
    pending.current.add(t.id);
    try {
      replace(await updateTask(t.id, { status: optimistic.status }));
    } catch (e) {
      replace(t); // revert
      setError((e as Error).message);
    } finally {
      pending.current.delete(t.id);
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    if (submitting) return; // guard against a double-submit creating duplicates
    const t = title.trim();
    if (!t) return;
    const proj = (project === "__new__" ? newProject : project).trim() || undefined;
    setError("");
    setSubmitting(true);
    try {
      const created = await createTask({ title: t, project: proj });
      // De-dupe: replace if this id already exists rather than appending twice.
      setTasks((cur) =>
        cur.some((x) => x.id === created.id)
          ? cur.map((x) => (x.id === created.id ? created : x))
          : [...cur, created],
      );
      setTitle("");
      setNewProject("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const groups = useMemo(() => {
    const open = tasks
      .filter((t) => t.status !== "done")
      .filter((t) => (statusFilter === "all" ? true : t.status === statusFilter));
    const byProject = new Map<string, Task[]>();
    for (const t of open) {
      const arr = byProject.get(t.project) ?? [];
      arr.push(t);
      byProject.set(t.project, arr);
    }
    const prioRank = { high: 0, medium: 1, low: 2 };
    for (const arr of byProject.values()) {
      arr.sort(
        (a, b) =>
          prioRank[a.priority] - prioRank[b.priority] || a.title.localeCompare(b.title),
      );
    }
    return [...byProject.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [tasks, statusFilter]);

  const done = tasks.filter((t) => t.status === "done");
  const pct = Math.round(stats.completion * 100);

  return (
    <div>
      <h2 className="section">Task board</h2>

      {/* progress header */}
      {stats.total > 0 && (
        <div className="task-progress">
          <div className="bar">
            <div className="bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="task-progress-meta">
            <span>
              <b>{stats.done}</b>/{stats.total} done ({pct}%)
            </span>
            <span>{stats.open} open</span>
            {stats.overdue > 0 && <span className="warn">{stats.overdue} overdue</span>}
            {stats.high > 0 && <span className="warn">{stats.high} high-priority</span>}
          </div>
        </div>
      )}

      <form className="todo-add" onSubmit={add} style={{ marginTop: 14 }}>
        <input
          placeholder="Jot a task…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <select
          className="project-select"
          value={project}
          style={{ flex: "0 0 170px" }}
          onChange={(e) => setProject(e.target.value)}
        >
          <option value="">Project…</option>
          {projects.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
          <option value="__new__">+ New project…</option>
        </select>
        {project === "__new__" && (
          <input
            placeholder="new project name"
            value={newProject}
            autoFocus
            style={{ flex: "0 0 160px" }}
            onChange={(e) => setNewProject(e.target.value)}
          />
        )}
        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? "Adding…" : "Add"}
        </button>
      </form>
      {error && <div className="banner">{error}</div>}

      {/* status filter */}
      <div className="seg">
        {(["all", "todo", "in_progress"] as StatusFilter[]).map((s) => (
          <button
            key={s}
            className={`seg-btn ${statusFilter === s ? "active" : ""}`}
            onClick={() => setStatusFilter(s)}
          >
            {s === "in_progress" ? "in progress" : s}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <div className="empty">No {statusFilter === "all" ? "open" : statusFilter.replace("_", " ")} tasks.</div>
      ) : (
        groups.map(([proj, items]) => (
          <div key={proj} className="task-project">
            <div className="task-project-head">
              <span className="name">{proj}</span>
              <span className="count">{items.length}</span>
            </div>
            {items.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                onToggle={toggle}
                onPatched={replace}
                openWiki={openWiki}
                focusId={focus?.id}
                focusN={focus?.n}
              />
            ))}
          </div>
        ))
      )}

      {done.length > 0 && (
        <>
          <hr className="divider" />
          <button className="btn small" onClick={() => setShowDone((s) => !s)}>
            {showDone ? "Hide" : "Show"} done ({done.length})
          </button>
          {showDone && (
            <div className="done-list" style={{ marginTop: 12 }}>
              {done.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  onToggle={toggle}
                  onPatched={replace}
                  openWiki={openWiki}
                  focusId={focus?.id}
                  focusN={focus?.n}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TaskRow({
  task,
  onToggle,
  onPatched,
  openWiki,
  focusId,
  focusN,
}: {
  task: Task;
  onToggle: (t: Task, done: boolean) => void | Promise<void>;
  onPatched: (t: Task) => void;
  openWiki: (slug: string) => void;
  focusId?: string;
  focusN?: number;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const color = projectColor(task.project);
  const overdue = isOverdue(task.due_date, task.status);

  // When this row is the focus target (from search), expand + scroll to it.
  useEffect(() => {
    if (focusId && focusId === task.id) {
      setOpen(true);
      ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, focusN]);

  async function handleCheck(checked: boolean) {
    setBusy(true);
    try {
      await onToggle(task, checked);
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(value: TaskStatus) {
    onPatched(await updateTask(task.id, { status: value }));
  }

  return (
    <div
      ref={ref}
      className={`task-row ${task.status === "done" ? "done" : ""} ${
        focusId === task.id ? "focused" : ""
      }`}
      style={color ? { borderLeftColor: color } : undefined}
    >
      <div className="task-grid">
        <input
          className="task-check"
          type="checkbox"
          checked={task.status === "done"}
          disabled={busy}
          onChange={(e) => handleCheck(e.target.checked)}
        />
        <span className="task-title" onClick={() => setOpen((o) => !o)}>
          {task.title}
        </span>
        <span className={`task-meta-pill prio-${task.priority}`}>{task.priority}</span>
        <span className={`task-meta-pill status-${task.status}`}>
          {task.status.replace("_", " ")}
        </span>
        <span className={`task-due ${overdue ? "overdue" : ""}`}>
          {task.due_date || ""}
        </span>
      </div>

      {open && (
        <div className="task-detail">
          <div className="field-row">
            <label>
              status{" "}
              <select
                value={task.status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
              >
                <option value="todo">todo</option>
                <option value="in_progress">in progress</option>
                <option value="done">done</option>
              </select>
            </label>
            {task.created_at && <span>created {task.created_at}</span>}
            {task.updated_at && <span>updated {task.updated_at}</span>}
            {task.tags.length > 0 && (
              <span>
                {task.tags.map((t) => (
                  <span key={t} className="tag" style={{ marginRight: 4 }}>
                    #{t}
                  </span>
                ))}
              </span>
            )}
            {task.page_slug && (
              <button className="inline-link" onClick={() => openWiki(task.page_slug)}>
                → {task.page_slug}
              </button>
            )}
          </div>
          {task.body && <Markdown body={task.body} onNavigate={openWiki} />}
        </div>
      )}
    </div>
  );
}
