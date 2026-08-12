import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Convex is a LIVE MIRROR of the git repo (the source of truth), not a second
// database. A cron pulls changed files from GitHub and upserts them here so the
// web app (and widgets) can subscribe to real-time updates without a redeploy.
// `files` tracks per-path blob SHAs so each sync only fetches what changed.
export default defineSchema({
  pages: defineTable({
    slug: v.string(),
    title: v.string(),
    summary: v.string(),
    tags: v.array(v.string()),
    sources: v.array(v.string()),
    updated: v.string(),
    body: v.string(),
  }).index("by_slug", ["slug"]),

  tasks: defineTable({
    taskId: v.string(),
    title: v.string(),
    status: v.string(),
    priority: v.string(),
    due_date: v.string(),
    project: v.string(),
    tags: v.array(v.string()),
    page_slug: v.string(),
    created_at: v.string(),
    updated_at: v.string(),
    completed_at: v.string(),
    body: v.string(),
  }).index("by_taskId", ["taskId"]),

  dailyNotes: defineTable({
    file: v.string(),
    date: v.string(),
    label: v.string(),
    preview: v.string(),
    body: v.string(),
  }).index("by_file", ["file"]),

  logEntries: defineTable({
    date: v.string(),
    action: v.string(),
    heading: v.string(),
    body: v.string(),
    order: v.number(),
  }),

  // sync bookkeeping
  files: defineTable({ path: v.string(), sha: v.string() }).index("by_path", ["path"]),
  meta: defineTable({ key: v.string(), value: v.string() }).index("by_key", ["key"]),
});
