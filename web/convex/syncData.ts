import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

// Stored per-path blob SHAs, so the sync action only fetches what changed.
export const fileShas = internalQuery({
  args: {},
  handler: async (ctx) =>
    (await ctx.db.query("files").collect()).map((f) => ({ path: f.path, sha: f.sha })),
});

// Apply one sync pass: upsert changed records, delete removed ones, optionally
// replace the log, and record the new SHAs + sync time. Records come in as
// `v.any()` (already shaped by the action) to keep this generic.
export const apply = internalMutation({
  args: {
    pages: v.array(v.any()),
    tasks: v.array(v.any()),
    daily: v.array(v.any()),
    replaceLog: v.optional(v.array(v.any())),
    deletePages: v.array(v.string()),
    deleteTasks: v.array(v.string()),
    deleteDaily: v.array(v.string()),
    shaUpserts: v.array(v.object({ path: v.string(), sha: v.string() })),
    shaDeletes: v.array(v.string()),
    lastSync: v.string(),
  },
  handler: async (ctx, a) => {
    for (const p of a.pages) {
      const ex = await ctx.db.query("pages").withIndex("by_slug", (q) => q.eq("slug", p.slug)).first();
      if (ex) await ctx.db.patch(ex._id, p);
      else await ctx.db.insert("pages", p);
    }
    for (const t of a.tasks) {
      const ex = await ctx.db.query("tasks").withIndex("by_taskId", (q) => q.eq("taskId", t.taskId)).first();
      if (ex) await ctx.db.patch(ex._id, t);
      else await ctx.db.insert("tasks", t);
    }
    for (const n of a.daily) {
      const ex = await ctx.db.query("dailyNotes").withIndex("by_file", (q) => q.eq("file", n.file)).first();
      if (ex) await ctx.db.patch(ex._id, n);
      else await ctx.db.insert("dailyNotes", n);
    }
    if (a.replaceLog) {
      for (const e of await ctx.db.query("logEntries").collect()) await ctx.db.delete(e._id);
      for (const e of a.replaceLog) await ctx.db.insert("logEntries", e);
    }
    for (const slug of a.deletePages) {
      const ex = await ctx.db.query("pages").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
      if (ex) await ctx.db.delete(ex._id);
    }
    for (const id of a.deleteTasks) {
      const ex = await ctx.db.query("tasks").withIndex("by_taskId", (q) => q.eq("taskId", id)).first();
      if (ex) await ctx.db.delete(ex._id);
    }
    for (const file of a.deleteDaily) {
      const ex = await ctx.db.query("dailyNotes").withIndex("by_file", (q) => q.eq("file", file)).first();
      if (ex) await ctx.db.delete(ex._id);
    }
    for (const { path, sha } of a.shaUpserts) {
      const ex = await ctx.db.query("files").withIndex("by_path", (q) => q.eq("path", path)).first();
      if (ex) await ctx.db.patch(ex._id, { sha });
      else await ctx.db.insert("files", { path, sha });
    }
    for (const path of a.shaDeletes) {
      const ex = await ctx.db.query("files").withIndex("by_path", (q) => q.eq("path", path)).first();
      if (ex) await ctx.db.delete(ex._id);
    }
    const m = await ctx.db.query("meta").withIndex("by_key", (q) => q.eq("key", "lastSync")).first();
    if (m) await ctx.db.patch(m._id, { value: a.lastSync });
    else await ctx.db.insert("meta", { key: "lastSync", value: a.lastSync });
  },
});
