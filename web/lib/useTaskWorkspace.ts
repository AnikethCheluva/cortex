"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createTask, deleteTask, updateTask } from "./clientapi";
import type { Task } from "./types";

export type TaskPatch = Parameters<typeof updateTask>[1];
export type TaskInput = Parameters<typeof createTask>[0];

// Owned by the dashboard, so switching tabs never discards a committed edit.
// Local overrides also protect changes from a lagging build/Convex snapshot.
export function useTaskWorkspace(initial: Task[]) {
  const [base, setBase] = useState(initial);
  const [overrides, setOverrides] = useState<Map<string, Task | null>>(
    new Map(),
  );
  const [pending, setPending] = useState<Set<string>>(new Set());
  const busy = useRef(new Set<string>());
  const revision = useRef(0);
  useEffect(() => {
    setBase(initial);
    // Once a live snapshot acknowledges a local write, let future remote
    // changes flow through instead of keeping that task pinned forever.
    setOverrides((previous) => {
      const next = new Map(previous);
      previous.forEach((task, id) => {
        if (busy.current.has(id)) return;
        const remote = initial.find((item) => item.id === id);
        if (
          (!task && !remote) ||
          (task && remote && JSON.stringify(task) === JSON.stringify(remote))
        )
          next.delete(id);
      });
      return next.size === previous.size ? previous : next;
    });
  }, [initial]);
  useEffect(() => {
    const controller = new AbortController();
    const version = revision.current;
    fetch("/api/tasks", { cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.tasks && revision.current === version) setBase(data.tasks);
      })
      .catch(() => {}); // The supplied vault snapshot remains available offline.
    return () => controller.abort();
  }, []);
  const tasks = useMemo(() => {
    const merged = new Map(base.map((task) => [task.id, task]));
    overrides.forEach((task, id) =>
      task ? merged.set(id, task) : merged.delete(id),
    );
    return [...merged.values()];
  }, [base, overrides]);
  const put = useCallback((id: string, task: Task | null) => {
    setOverrides((previous) => new Map(previous).set(id, task));
  }, []);
  const lock = useCallback((id: string, value: boolean) => {
    if (value) busy.current.add(id);
    else busy.current.delete(id);
    setPending(new Set(busy.current));
  }, []);
  const save = useCallback(
    async (task: Task, patch: TaskPatch) => {
      if (busy.current.has(task.id))
        throw new Error("This task is still saving. Please try again.");
      revision.current++;
      lock(task.id, true);
      put(task.id, { ...task, ...patch });
      try {
        put(task.id, await updateTask(task.id, patch));
      } catch (error) {
        put(task.id, task);
        throw error;
      } finally {
        lock(task.id, false);
      }
    },
    [lock, put],
  );
  const add = useCallback(
    async (input: TaskInput) => {
      revision.current++;
      const task = await createTask(input);
      put(task.id, task);
      return task;
    },
    [put],
  );
  const remove = useCallback(
    async (task: Task) => {
      if (busy.current.has(task.id))
        throw new Error("This task is still saving. Please try again.");
      revision.current++;
      lock(task.id, true);
      put(task.id, null);
      try {
        await deleteTask(task.id);
      } catch (error) {
        put(task.id, task);
        throw error;
      } finally {
        lock(task.id, false);
      }
    },
    [lock, put],
  );
  return { tasks, pending, save, add, remove };
}
