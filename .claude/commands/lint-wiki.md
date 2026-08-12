---
description: Health-check the wiki — broken links, orphans, contradictions, stale flags, content gaps
argument-hint: [folder, default = whole wiki]
---

Run a health check over `wiki/` (scope: $ARGUMENTS if given, else the whole wiki).

First read `.claude/instructions/obsidian-markdown-lint.md` in full. Then report (and fix where safe):

1. **Broken wikilinks** — `[[links]]` pointing to non-existent pages. List them; offer to create stubs or fix typos.
2. **Orphan pages** — pages in `wiki/INDEX.md` with no inbound wikilinks. Suggest a hub or related page to connect each.
3. **Contradictions** — pages making conflicting claims. Add a `> [!warning] Stale — see [newer source]` callout to the older one; never silently overwrite.
4. **Index drift** — pages on disk missing from `wiki/INDEX.md`, or index entries whose files are gone.
5. **Source citations** — every `wiki/pages/` page must have a `sources:` entry; flag any uncited page.
6. **Formatting** — apply markdown-lint rules: fix spelling/grammar/special-character issues without changing meaning. Remember angle brackets in prose must be backticked.
7. **Content gaps** — list 2–3 concepts mentioned often but lacking their own page, or `sources/` material not yet represented in the wiki; suggest an `/ingest` to fill each.

Fix formatting and obvious link issues directly; ask before creating new pages or restructuring. Append to `wiki/LOG.md`: `## [YYYY-MM-DD] lint | [scope]`.
