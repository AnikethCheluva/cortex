"use client";

import { useRef, useState, type FormEvent } from "react";
import { todayISO } from "@/lib/day";
import { dueLabel } from "@/lib/task-dates";
import type { useTaskWorkspace } from "@/lib/useTaskWorkspace";
import type { Task } from "@/lib/types";
import { Icon } from "./Icon";

export function TodayTasks({
  workspace,
  openTask,
  openTasks,
}: {
  workspace: ReturnType<typeof useTaskWorkspace>;
  openTask: (id: string) => void;
  openTasks: () => void;
}) {
  const today = todayISO();
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const submitting = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const due = workspace.tasks
    .filter((t) => t.status !== "done" && t.due_date && t.due_date <= today)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const done = workspace.tasks.filter(
    (t) =>
      t.status === "done" && (t.completed_at === today || t.due_date === today),
  );
  async function add(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setError("");
    try {
      await workspace.add({
        title: title.trim(),
        due_date: today,
        priority: "medium",
        project: "personal",
      });
      setTitle("");
      input.current?.focus();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
      submitting.current = false;
    }
  }
  async function toggle(task: Task) {
    setError("");
    try {
      await workspace.save(task, {
        status: task.status === "done" ? "todo" : "done",
      });
    } catch (err) {
      setError((err as Error).message);
    }
  }
  const row = (task: Task) => (
    <li key={task.id} className={task.status === "done" ? "is-done" : ""}>
      <button
        className="quick-task-check"
        aria-label={`${task.status === "done" ? "Reopen" : "Complete"} ${task.title}`}
        aria-pressed={task.status === "done"}
        disabled={workspace.pending.has(task.id)}
        onClick={() => void toggle(task)}
      >
        <span>{task.status === "done" && <Icon name="check" size={14} />}</span>
      </button>
      <button className="quick-task-detail" onClick={() => openTask(task.id)}>
        <span>{task.title}</span>
        {task.due_date < today && task.status !== "done" && (
          <small>{dueLabel(task.due_date, today)}</small>
        )}
      </button>
      <Icon name="chevron" size={14} />
    </li>
  );
  return (
    <section className="today-tasks" aria-label="Today's tasks">
      <div className="capture-section-heading">
        <h2>
          Today’s tasks <span>{due.length}</span>
        </h2>
        <button className="quiet-button" onClick={openTasks}>
          All tasks <Icon name="arrow" size={14} />
        </button>
      </div>
      <form className="quick-task-form" onSubmit={add}>
        <input
          ref={input}
          aria-label="New task for today"
          placeholder="Add a task for today…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={saving}
          enterKeyHint="done"
        />
        <button
          className="icon-button"
          aria-label="Add task for today"
          disabled={saving || !title.trim()}
        >
          <Icon name="plus" />
        </button>
      </form>
      {error && (
        <div className="banner" role="alert">
          {error}
        </div>
      )}
      <ul className="quick-task-list">
        {(expanded ? due : due.slice(0, 5)).map(row)}
      </ul>
      {!due.length && <p className="capture-hint">No tasks due.</p>}
      {due.length > 5 && (
        <button className="quiet-button" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Show fewer" : `Show all ${due.length} tasks`}
        </button>
      )}
      {done.length > 0 && (
        <>
          <button
            className="quiet-button completed-toggle"
            aria-expanded={showDone}
            onClick={() => setShowDone((v) => !v)}
          >
            <Icon name="check" size={14} />
            {done.length} completed today
          </button>
          {showDone && <ul className="quick-task-list">{done.map(row)}</ul>}
        </>
      )}
    </section>
  );
}
