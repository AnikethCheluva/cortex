import { NextResponse } from "next/server";
import { readVaultFile, listVaultDir } from "@/lib/storage";
import { parseTask } from "@/lib/parse";
import { todayISO, todayStem, prettyISO } from "@/lib/day";
import { currentStreak, taskStats } from "@/lib/stats";
import type { Task } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// M-D-YY or ISO stem → YYYY-MM-DD (for the daily streak).
function stemToISO(stem: string): string | null {
  const iso = stem.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const mdy = stem.match(/^(\d{1,2})-(\d{1,2})-(\d{2})$/);
  if (mdy) return `20${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  return null;
}

const PRIO = { high: 0, medium: 1, low: 2 } as const;

// GET → a single glanceable snapshot for widgets / menu bar / any frontend:
// today's note status, daily streak, task stats, top open tasks, and counts.
export async function GET() {
  const today = todayISO();

  const [taskStems, dailyStems, pageStems, todayFile] = await Promise.all([
    listVaultDir("wiki/tasks"),
    listVaultDir("sources/daily"),
    listVaultDir("wiki/pages"),
    readVaultFile(`sources/daily/${todayStem()}.md`),
  ]);

  const tasks: Task[] = (
    await Promise.all(
      taskStems.map(async (id) => {
        const f = await readVaultFile(`wiki/tasks/${id}.md`);
        return f ? parseTask(id, f.content) : null;
      }),
    )
  ).filter((t): t is Task => t !== null);

  const stats = taskStats(tasks, today);
  const dates = new Set(dailyStems.map(stemToISO).filter((d): d is string => !!d));
  const streak = currentStreak(dates, today);

  const top = tasks
    .filter((t) => t.status !== "done")
    .sort(
      (a, b) => PRIO[a.priority] - PRIO[b.priority] || a.title.localeCompare(b.title),
    )
    .slice(0, 5)
    .map((t) => ({
      id: t.id,
      title: t.title,
      project: t.project,
      priority: t.priority,
      status: t.status,
      due_date: t.due_date,
    }));

  return NextResponse.json(
    {
      today: { stem: todayStem(), label: prettyISO(today), exists: Boolean(todayFile) },
      streak,
      tasks: {
        total: stats.total,
        open: stats.open,
        done: stats.done,
        overdue: stats.overdue,
        high: stats.high,
        inProgress: stats.inProgress,
        top,
      },
      counts: { pages: pageStems.length, tasks: tasks.length, daily: dailyStems.length },
      generatedAt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
