// Thin client over the Cortex HTTP API (see web/API.md). Git is the source
// of truth; these calls read/commit the repo through the same endpoints the web
// app uses. Reads are open; writes send the optional Bearer token when set.
import { getPreferenceValues } from "@raycast/api";

interface Prefs {
  baseUrl: string;
  apiToken?: string;
}

export function prefs(): { base: string; token?: string } {
  const p = getPreferenceValues<Prefs>();
  return {
    base: (p.baseUrl || "").replace(/\/+$/, ""),
    token: p.apiToken?.trim() || undefined,
  };
}

function headers(token?: string, json = false): Record<string, string> {
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function apiGet<T>(path: string): Promise<T> {
  const { base, token } = prefs();
  const res = await fetch(`${base}${path}`, { headers: headers(token) });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export async function apiSend<T>(method: string, path: string, body: unknown): Promise<T> {
  const { base, token } = prefs();
  const res = await fetch(`${base}${path}`, {
    method,
    headers: headers(token, true),
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error((data.error as string) || `${method} ${path} → ${res.status}`);
  }
  return data as T;
}

// ---- shapes returned by the API ----
export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "high" | "medium" | "low";

export interface TaskItem {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  project: string;
  due_date: string;
}

export interface Overview {
  today: { stem: string; label: string; exists: boolean };
  streak: number;
  tasks: {
    total: number;
    open: number;
    done: number;
    overdue: number;
    high: number;
    inProgress: number;
    top: TaskItem[];
  };
  counts: { pages: number; tasks: number; daily: number };
  generatedAt: string;
}
