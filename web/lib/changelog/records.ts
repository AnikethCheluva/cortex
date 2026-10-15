import { createHash } from "node:crypto";
import { safeMatter, ymd } from "../parse";
import { dailyDate } from "../day";
import type { ChangeRecord, ChangeSurface, DailyChangelog } from "./types";

export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function changeDate(timestamp: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  return ["year", "month", "day"]
    .map((key) => parts.find((p) => p.type === key)!.value)
    .join("-");
}
export function surfaceFor(file: string): ChangeSurface | null {
  if (file.startsWith("wiki/changelog/") || /wiki\/srs\/_/.test(file))
    return null;
  if (file.startsWith("wiki/tasks/") && !/\/(README|index)\.md$/i.test(file))
    return "tasks";
  if (file.startsWith("sources/notes/")) return "docs";
  if (file.startsWith("sources/daily/")) return "daily";
  if (file.startsWith("wiki/srs/")) return "recall";
  if (file.startsWith("wiki/")) return "wiki";
  if (file.startsWith("sources/")) return "sources";
  return null;
}
export function fileRecord(
  file: string,
  before: string | null,
  after: string | null,
  context: Pick<ChangeRecord, "timestamp" | "source" | "runId">,
): ChangeRecord | null {
  const surface = surfaceFor(file);
  if (!surface || before === after) return null;
  const old = safeMatter(before ?? "");
  const next = safeMatter(after ?? "");
  const fields =
    surface === "tasks"
      ? ["title", "status", "priority", "due_date", "project", "completed_at"]
      : ["title", "folder"];
  const metadata = (
    raw: string | null,
    parsed: ReturnType<typeof safeMatter>,
  ) => {
    if (raw === null) return undefined;
    const result: Record<string, string | number | boolean> = {
      bytes: Buffer.byteLength(raw),
    };
    for (const field of fields) result[field] = ymd(parsed.data[field]);
    return result;
  };
  const changedFields = fields.filter(
    (field) => ymd(old.data[field]) !== ymd(next.data[field]),
  );
  if (old.content.trim() !== next.content.trim()) changedFields.push("body");
  const action =
    before === null
      ? "created"
      : after === null
        ? "deleted"
        : surface === "tasks" && changedFields.includes("status")
          ? "status_changed"
          : "updated";
  const stem = file.split("/").pop()!.replace(/\.md$/i, "");
  return {
    ...context,
    id: digest([context.source, context.runId, file, before, after].join("\0")),
    surface,
    action,
    path: file,
    title: String(next.data.title || old.data.title || stem),
    before: metadata(before, old),
    after: metadata(after, next),
    changedFields,
    ...(surface === "daily" ? { noteDate: dailyDate(stem).iso } : {}),
  };
}
export function readChangelog(
  raw: string | null,
  date: string,
): DailyChangelog {
  if (!raw)
    return { version: 1, date, timezone: "America/New_York", records: [] };
  const parsed = JSON.parse(raw) as DailyChangelog;
  if (
    parsed.version !== 1 ||
    parsed.date !== date ||
    !Array.isArray(parsed.records)
  )
    throw new Error(`Invalid changelog: ${date}`);
  return parsed;
}
export function mergeRecords(
  day: DailyChangelog,
  incoming: ChangeRecord[],
): DailyChangelog {
  const records = new Map(day.records.map((record) => [record.id, record]));
  for (const record of incoming) {
    if (changeDate(record.timestamp) !== day.date)
      throw new Error("Changelog record belongs to another day");
    if (!records.has(record.id)) records.set(record.id, record);
  }
  return {
    ...day,
    records: [...records.values()].sort(
      (a, b) =>
        a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id),
    ),
  };
}
export const changelogPath = (date: string) => `wiki/changelog/${date}.json`;
