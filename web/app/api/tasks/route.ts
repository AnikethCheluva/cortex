import { NextResponse } from "next/server";
import { readVaultFile, writeVaultFile, listVaultDir } from "@/lib/storage";
import { buildTaskFile, parseTask, slugify } from "@/lib/parse";
import { todayISO } from "@/lib/day";
import { apiAuthorized, unauthorized } from "@/lib/apiauth";
import type { Task } from "@/lib/types";

export const dynamic = "force-dynamic"; // read/write endpoint, runs at request time
export const maxDuration = 30;

// GET → every task (todo / in_progress / done). Powers a full task list in any
// client (Raycast, a native app); the web app uses the build-time/Convex data.
export async function GET() {
  const ids = await listVaultDir("wiki/tasks");
  const tasks: Task[] = (
    await Promise.all(
      ids.map(async (id) => {
        const f = await readVaultFile(`wiki/tasks/${id}.md`);
        return f ? parseTask(id, f.content) : null;
      }),
    )
  ).filter((t): t is Task => t !== null);
  return NextResponse.json({ tasks }, { headers: { "Cache-Control": "no-store" } });
}

// Quick-add a task → commits wiki/tasks/<slug>.md in the README format.
export async function POST(req: Request) {
  if (!apiAuthorized(req)) return NextResponse.json(unauthorized(), { status: 401 });
  try {
    const body = await req.json();
    const title = String(body?.title ?? "").trim();
    if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

    const id = slugify(title);
    const rel = `wiki/tasks/${id}.md`;
    if (await readVaultFile(rel)) {
      return NextResponse.json(
        { error: "a task with this title already exists" },
        { status: 409 },
      );
    }
    const content = buildTaskFile({
      title,
      project: body.project,
      priority: body.priority,
      due_date: body.due_date,
      page_slug: body.page_slug,
      tags: Array.isArray(body.tags) ? body.tags : undefined,
      today: todayISO(),
    });
    await writeVaultFile(rel, content, `wiki: add task ${id}`);
    return NextResponse.json(parseTask(id, content), { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
