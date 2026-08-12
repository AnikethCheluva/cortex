# LLM Wiki

> *"Obsidian is the IDE, the LLM is the programmer, the wiki is the codebase."*

A personal knowledge system where **you write raw notes** and **an LLM (Claude)
compiles them into a synthesized, interlinked wiki** — then a polished web app,
a spaced-repetition engine, a calendar planner, and a set of clients let you
live in it.

This repo is the **skeleton**: all the tooling around a wiki, with a small
fictional example vault so it runs the moment you clone it. Point it at your own
notes and it becomes your second brain. Git is always the source of truth.

<!-- Add a screenshot/GIF of the web app here once deployed. -->

## The idea

```
sources/   →  INPUT. You write raw notes + drop in material, organized by life area.
wiki/      →  OUTPUT. Claude builds the synthesized, interlinked pages from sources.
CLAUDE.md  →  The rules that turn sources into the wiki.
```

You never hand-edit the wiki. When a new note arrives, Claude integrates it —
creating and cross-linking pages, flagging contradictions, updating the index and
the op log. Every wiki claim traces back to a source file.

## Features

| Area | What it does |
|---|---|
| **Web app** (`web/`) | Next.js reader/editor for the whole vault — deploy to Vercel |
| **Overview + Recall dashboard** | At-a-glance stats + a spaced-repetition dashboard (true retention, stability growth, due forecast, calibration) |
| **Today / Daily notes** | Dated notes with a rich editor; a daily recall quiz |
| **Docs** | Google-Docs-style long-form documents, saved as wiki sources |
| **Calendar** | Google/Outlook calendar view + an agent-scoped **"Planned"** overlay of project deliverables |
| **Wiki + Tasks** | Browse interlinked pages by type; a git-backed task board |
| **Spaced repetition** (`wiki/srs/`) | Keyless FSRS — Claude generates cards from your notes and grades answers; the app just captures them |
| **Ingest commands** (`.claude/`) | `/ingest`, `/process-inbox`, `/lint-wiki` — how Claude compiles + maintains the wiki |
| **Clients** (`clients/`) | Raycast extension + iOS Shortcuts to jot/add tasks from anywhere |
| **Slack bot** (`tooling/slackbot/`) | A conversational front door: `/wiki <verb>` → headless Claude on the vault |
| **Live mirror** (`web/convex/`) | Optional Convex mirror for real-time updates between deploys |

## Quick start

```bash
git clone <this-repo> llm-wiki
cd llm-wiki/web
npm install
npm run dev            # → http://localhost:3000
```

It runs on the bundled **example vault** (`examples/vault/`) out of the box —
browse the demo wiki, tasks, daily notes, calendar, and recall dashboard.

## Use your own notes

The app finds your content via `VAULT_PATH` (the directory that holds `sources/`
and `wiki/`). Two easy layouts:

- **Sibling repo** — keep your notes in their own (private) repo next to this one:
  ```bash
  cd web && VAULT_PATH=../../my-wiki npm run dev
  ```
- **Drop-in** — put your own `sources/` and `wiki/` at the repo root; unset,
  `VAULT_PATH` falls back to the parent of `web/`.

For write-back and deployment (committing edits from the app to GitHub), set
`GITHUB_TOKEN` + `GITHUB_REPO` — see [`web/.env.example`](web/.env.example) and
[`web/DEPLOY.md`](web/DEPLOY.md).

## Repository layout

```
web/            Next.js web app (the main interface) — see web/README.md
clients/        Raycast extension + iOS Shortcuts
tooling/        The Slack bot (setup + env; see tooling/slackbot/README.md)
.claude/        Slash commands + instructions that drive Claude's wiki work
examples/vault/ Fictional demo content (sources/ + wiki/) — replace with yours
CLAUDE.md       The schema: how sources become the wiki (customize this)
```

## Regenerate the demo recall data

The example spaced-repetition history is time-anchored so the dashboard looks
alive. Refresh it (optionally edit `BASE` to today) with:

```bash
node examples/seed-demo-srs.mjs
```

## License

MIT — see [LICENSE](LICENSE).
