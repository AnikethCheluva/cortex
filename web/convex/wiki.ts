import { query } from "./_generated/server";

// The whole vault, reactive. Shape matches the web app's VaultData so the client
// can drop it in place of the build-time snapshot. Subscribing clients get live
// updates whenever the cron sync changes a row.
export const getVault = query({
  args: {},
  handler: async (ctx) => {
    const [pages, tasks, dailyNotes, logEntries, meta] = await Promise.all([
      ctx.db.query("pages").collect(),
      ctx.db.query("tasks").collect(),
      ctx.db.query("dailyNotes").collect(),
      ctx.db.query("logEntries").collect(),
      ctx.db
        .query("meta")
        .withIndex("by_key", (q) => q.eq("key", "lastSync"))
        .first(),
    ]);

    return {
      wiki: pages
        .map((p) => ({
          slug: p.slug,
          title: p.title,
          summary: p.summary,
          tags: p.tags,
          sources: p.sources,
          updated: p.updated,
          body: p.body,
        }))
        .sort((a, b) => (b.updated || "").localeCompare(a.updated || "")),
      tasks: tasks.map((t) => ({
        id: t.taskId,
        title: t.title,
        status: t.status,
        priority: t.priority,
        due_date: t.due_date,
        project: t.project,
        tags: t.tags,
        page_slug: t.page_slug,
        created_at: t.created_at,
        updated_at: t.updated_at,
        completed_at: t.completed_at,
        body: t.body,
      })),
      daily: dailyNotes
        .map((n) => ({ file: n.file, date: n.date, label: n.label, preview: n.preview, body: n.body }))
        .sort((a, b) => {
          if (a.date && b.date) return b.date.localeCompare(a.date);
          if (a.date) return -1;
          if (b.date) return 1;
          return b.file.localeCompare(a.file);
        }),
      log: logEntries.sort((a, b) => a.order - b.order).map((e) => ({
        date: e.date,
        action: e.action,
        heading: e.heading,
        body: e.body,
      })),
      builtAt: meta?.value ?? "",
    };
  },
});
