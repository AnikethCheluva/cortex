import { NextResponse } from "next/server";
import { readVaultFile, writeVaultFile } from "@/lib/storage";
import { parseTask } from "@/lib/parse";
import { setFrontmatterField, replaceBody } from "@/lib/frontmatter";
import { todayISO } from "@/lib/day";
import { apiAuthorized, unauthorized } from "@/lib/apiauth";

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
    const rel = `wiki/tasks/${id}.md`;
    const file = await readVaultFile(rel);
    if (!file) return NextResponse.json({ error: "not found" }, { status: 404 });

    let raw = file.content;
    if (typeof body.body === "string") raw = replaceBody(raw, body.body);
    if (body.status && STATUSES.includes(body.status)) {
      raw = setFrontmatterField(raw, "status", body.status);
      if (body.status === "done") {
        raw = setFrontmatterField(raw, "completed_at", todayISO());
      }
    }
    if (body.priority && PRIORITIES.includes(body.priority)) {
      raw = setFrontmatterField(raw, "priority", body.priority);
    }
    raw = setFrontmatterField(raw, "updated_at", todayISO());

    await writeVaultFile(rel, raw, `wiki: update task ${id}`);
    return NextResponse.json(parseTask(id, raw));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
