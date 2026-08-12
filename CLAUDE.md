# CLAUDE.md — LLM Wiki

The **schema** for Claude Code sessions in this vault. Read it at the start of every session.

> **"Obsidian is the IDE, the LLM is the programmer, the wiki is the codebase."**
>
> You write raw notes and collect material in `sources/`. **Claude builds and maintains `wiki/`** — the synthesized, interlinked knowledge base — from those sources. The wiki is not hand-edited.

> **Customize this file.** The layout below is a starting point (mirrored by the demo in `examples/vault/`). Edit the life-area table in Layer 1 to match how *you* organize your notes, then delete this line.

---

## The Model

```
sources/   →  INPUT. Human-authored notes + raw material, organized by life area. (You edit.)
inbox/     →  staging for new captures before they're filed into sources/.
wiki/      →  OUTPUT. Fully Claude-generated synthesis: atomic, linked pages built from sources. (Claude maintains.)
CLAUDE.md  →  SCHEMA. This file + wiki/wiki-schema.md = the rules turning sources into the wiki.
```

| Layer | Path | Who writes it | Contents |
|---|---|---|---|
| **Sources** | `sources/` | You (raw evidence) | Your notes, PDFs, transcripts, clips — the source of truth. Claude **reads**, never overwrites. |
| **Inbox** | `inbox/` | You drop, Claude files | New captures awaiting placement into `sources/<area>/`. |
| **Wiki** | `wiki/` | **Claude only** | `pages/` (one concept per file), `index.md` (catalog), `log.md` (op log), `wiki-schema.md` (page rules). |
| **Schema** | `CLAUDE.md`, `.claude/` | On request | Governing rules + operating guides + slash commands. |

**Core principle:** knowledge is *compiled once and kept current*. When a new source arrives, integrate it into the wiki — create/update the relevant pages, cross-link, flag contradictions. A single source should touch 5–15 wiki pages. Every wiki claim traces back to a `sources/` file.

---

## Layer 1 — `sources/` (your material, by life area)

**Immutable to Claude.** Read from it; write synthesis to `wiki/`. Organize it by whatever areas fit your life. A common set (adapt freely):

| Area | Path | Holds |
|---|---|---|
| **Daily** | `sources/daily/` | Dated daily notes (`YYYY-MM-DD.md`). |
| **Notes** | `sources/notes/` | Long-form persistent documents (the web app's Docs tab). |
| **Work / School** | `sources/<area>/` | Projects, coursework, research — one folder per area, sub-foldered as needed. |
| **Research** | `sources/research/` | `readings/` (one file per paper), `logs/`, `notes/`. |
| **Personal** | `sources/personal/` | Goals, career, activities, ideas. |
| **Archive** | `sources/archive/` | Historical material — read-only in spirit. |

**Naming:** prefer dated, topic-tagged filenames for new captures — `2026-06-09-product-call.md` — so they sort and ingest cleanly.

---

## Layer 2 — `wiki/` (Claude-generated)

- **`wiki/pages/`** — atomic, interlinked articles, one concept/entity per file. Structure defined in `wiki/wiki-schema.md`.
- **`wiki/index.md`** — catalog: one line per page. Update on every new/changed page.
- **`wiki/log.md`** — append-only op log. `## [YYYY-MM-DD] action | description`. Append every session that changes the vault.
- **`wiki/wiki-schema.md`** — the page-structure spec (frontmatter, citations, linking, the Tagging rulebook).
- **`wiki/tasks/`** — the git-backed task board. **`wiki/srs/`** — the spaced-repetition card bank + review log. **`wiki/calendar/planned.json`** — agent-scoped "Planned" calendar deliverables.

**Do not hand-edit wiki pages as if they were notes.** They are regenerated/maintained from sources. If a page is wrong, fix the source or regenerate the page.

---

## Interaction Model

The vault is one git repo — **the files in `sources/` and `wiki/` are the source of truth** — reachable through two front doors:

- **The web app** (`web/`, Next.js on Vercel) is the primary interface: browsing and editing wiki pages, the task board, daily notes, and docs.
- **The Slack bot** (`tooling/slackbot/`, optional) is a quick conversational door: pull information, jot notes, trigger ingests.

Both write to the same repo, so **always work from the latest state and keep edits small and well-scoped** so they merge cleanly. A chat message is a **request, not the source of truth** — read `sources/` and `wiki/` before acting.

**Operating principles (every request):**
1. Treat a chat/Slack message as a **request**; read `sources/` and `wiki/` before answering or changing anything — prefer files over memory.
2. **Extract, don't invent** — only claims grounded in a source or an existing page.
3. Write back consistently — update the right page, create atomic pages when needed, link related concepts.
4. **Log every change** in `wiki/log.md` — source filenames, pages updated, anything uncertain or skipped.
5. If a request is ambiguous, ask **one focused follow-up** instead of guessing.

---

## The Operations (`.claude/commands/`)

1. **`/ingest <url-or-source-path>`** — Compile a source into the wiki. If a URL, first save the raw capture into the right `sources/<area>/` (dated filename), then read it and synthesize: create/update concept + entity pages in `wiki/pages/`, cite the source in each page's `sources:`, cross-link, update `wiki/index.md`, append to `wiki/log.md`. One pass touches 5–15 pages. With no argument, sweep `sources/` for material not yet in the wiki.
2. **`/process-inbox`** — For each capture in `inbox/`, file it into the correct `sources/<area>/` (don't synthesize yet), then optionally `/ingest` it. Clear the inbox.
3. **`/lint-wiki`** — Health check over `wiki/`: broken wikilinks, orphan pages, contradictions/stale flags, index drift, content gaps.

---

## Standing Rules

1. **Never write generated content into `sources/`.** Synthesis goes in `wiki/`. (Saving a *raw* capture into `sources/<area>/` is fine — that's input.)
2. **Never hand-edit `wiki/pages/` as notes.** Regenerate from sources.
3. **`sources/archive/` is historical** — don't rewrite it.
4. **Every wiki page cites its sources.** No claim without a `sources:` entry.
5. **Keep `inbox/` empty** after filing.
6. **Backtick angle brackets** (`<T>`) in prose.
7. **Catalog + log** every change (`wiki/index.md`, `wiki/log.md`).
8. **Index-first for queries;** file non-trivial answers back as pages.

---

## Version control

The vault is a git repo (synced to a remote). Commit meaningful changes. Keep build output, secrets, and per-machine files out of git (see `.gitignore`).
