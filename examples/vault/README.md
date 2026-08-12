# Starter vault

This is an **empty starter vault** — the correct folder structure with only the
starter files, ready for you to fill with your own notes. The app runs on this by
default.

```
inbox/                 drop new captures here; /process-inbox files them
sources/               YOUR raw notes (the input) — organize by life area
  daily/               dated daily notes (YYYY-MM-DD.md)
  notes/               long-form persistent documents (the Docs tab)
  archive/             historical material
_templates/            copy these when creating pages/tasks/notes
wiki/                  CLAUDE-GENERATED synthesis (don't hand-edit as notes)
  pages/               one atomic, interlinked page per concept
  tasks/               the task board
  srs/                 spaced-repetition card bank + review log
  calendar/            planned.json — agent-scoped calendar deliverables
  index.md             catalog of every page
  log.md               append-only op log
  wiki-schema.md       the rules every page follows  ← read this
```

## Start here
1. Read **`wiki/wiki-schema.md`** (page rules) and the repo root **`CLAUDE.md`**
   (how sources become the wiki). Customize the life-area list in `CLAUDE.md`.
2. Write a note into `sources/` (e.g. `sources/daily/2026-01-15.md`), or drop
   material into `inbox/`.
3. Run `/ingest` (or `/process-inbox`) in Claude Code from the vault root to
   compile it into `wiki/pages/`.

Already have a vault? See **"Choose your vault"** in the repo root `README.md` to
point the app at your own existing setup instead of this one.
