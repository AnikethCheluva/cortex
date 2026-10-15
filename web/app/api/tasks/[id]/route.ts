import { NextResponse } from "next/server";
import { deleteVaultFile, readVaultFile, writeVaultFile } from "@/lib/storage";
import { parseTask } from "@/lib/parse";
import { setFrontmatterField, replaceBody } from "@/lib/frontmatter";
import { todayISO } from "@/lib/day";
import { apiAuthorized, unauthorized } from "@/lib/apiauth";
import { validTaskDate } from "@/lib/task-dates";

export const dynamic = "force-dynamic";

const STATUSES = ["todo", "in_progress", "done"];
const PRIORITIES = ["high", "medium", "low"];

// Update a task in place: status / priority / notes. Surgical frontmatter edits
// keep the diff minimal so other writers (the Slack bot, /ingest) don't fight it.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!apiAuthorized(req)) return NextResponse.json(unauthorized(), { status: 401 });
  const { id } = await params;
  if (id.includes("/") || id.includes("..")) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid task update");
    if ("due_date" in body && !validTaskDate(body.due_date)) throw new Error("Use a valid due date (YYYY-MM-DD)");
    if ("status" in body && !STATUSES.includes(body.status)) throw new Error("Invalid status");
    if ("priority" in body && !PRIORITIES.includes(body.priority)) throw new Error("Invalid priority");
    if ("estimate_minutes" in body && (!Number.isInteger(body.estimate_minutes) || body.estimate_minutes < 0 || body.estimate_minutes > 480)) throw new Error("Estimate must be between 0 and 480 minutes");
    if ("timebox_start" in body && (typeof body.timebox_start !== "string" || (body.timebox_start && Number.isNaN(Date.parse(body.timebox_start))))) throw new Error("Use a valid scheduled time");
    if ("title" in body && (typeof body.title !== "string" || !body.title.trim())) throw new Error("Title required");
    if ("project" in body && typeof body.project !== "string") throw new Error("Invalid project");
    const rel = `wiki/tasks/${id}.md`;
    const file = await readVaultFile(rel);
    if (!file) return NextResponse.json({ error: "not found" }, { status: 404 });

    let raw = file.content;
    if ("due_date" in body) raw = setFrontmatterField(raw, "due_date", body.due_date);
    if ("title" in body) raw = setFrontmatterField(raw, "title", JSON.stringify(body.title.trim()));
    if ("project" in body) raw = setFrontmatterField(raw, "project", JSON.stringify(body.project.trim() || "unsorted"));
    if (typeof body.body === "string") raw = replaceBody(raw, body.body);
    if (body.status && STATUSES.includes(body.status)) {
      raw = setFrontmatterField(raw, "status", body.status);
      if (body.status === "done") {
        raw = setFrontmatterField(raw, "completed_at", todayISO());
      } else {
        raw = setFrontmatterField(raw, "completed_at", "");
      }
    }
    if (body.priority && PRIORITIES.includes(body.priority)) {
      raw = setFrontmatterField(raw, "priority", body.priority);
    }
    if ("estimate_minutes" in body) raw = setFrontmatterField(raw, "estimate_minutes", String(body.estimate_minutes));
    if ("timebox_start" in body) raw = setFrontmatterField(raw, "timebox_start", body.timebox_start);
    raw = setFrontmatterField(raw, "updated_at", todayISO());

    await writeVaultFile(rel, raw, `wiki: update task ${id}`);
    return NextResponse.json(parseTask(id, raw));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

// Delete a task outright — for the ones that simply stopped being relevant, where
// marking them "done" would be a lie. The file is removed from wiki/tasks/, so
// it's still recoverable from git history if it turns out to matter.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!apiAuthorized(req)) return NextResponse.json(unauthorized(), { status: 401 });
  const { id } = await params;
  if (id.includes("/") || id.includes("..")) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  try {
    const rel = `wiki/tasks/${id}.md`;
    const file = await readVaultFile(rel);
    if (!file) return NextResponse.json({ error: "not found" }, { status: 404 });
    await deleteVaultFile(rel, `wiki: delete task ${id}`);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
