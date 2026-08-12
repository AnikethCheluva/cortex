---
description: File each capture in inbox/ into the right sources/ life-area, then optionally ingest into the wiki
---

Process everything in `inbox/`.

For each file in `inbox/`:
1. Read it and decide its life area under `sources/` — the top-level areas your `CLAUDE.md` defines (e.g. `sources/<area>/` for work/school/research, `sources/daily/` for dated notes, `sources/notes/` for long-form documents), or `sources/archive/` for historical material. (The example vault ships a couple of areas to model; customize the set in `CLAUDE.md`.)
2. Move it into that `sources/<area>/` with a clean dated filename (`YYYY-MM-DD-topic.md`). This is **filing raw material**, not synthesis — don't rewrite the content.
3. Delete the original inbox copy.

After filing all items:
- Offer to `/ingest` the newly filed sources to build/update their wiki pages.
- Append to `wiki/log.md`: `## [YYYY-MM-DD] inbox | filed N items → <areas>`.
- Confirm `inbox/` is empty.

If `inbox/` is empty, say so and stop.
