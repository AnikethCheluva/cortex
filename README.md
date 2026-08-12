# Cortex

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

## Features in depth

Everything below is plain markdown + JSON in the vault — edited in a polished web
UI, but always just files in git. All of it is visible in the demo vault
(`node scripts/use-vault.mjs examples/demo-vault`).

### 📅 Daily notes
Dated notes at `sources/daily/YYYY-MM-DD.md` — the raw stream your wiki is built
from.
- **Today** opens today's note in a rich editor (headings, lists, checkboxes,
  inline LaTeX) with a notebook-style page; **Daily** lists every past note with a
  one-line summary.
- **Voice notes** — dictate straight into a note instead of typing. On Chrome and
  Safari (including iPhone) it uses the browser's on-device **Web Speech API** —
  **free, no API key, and the audio never leaves your device**. An optional
  OpenAI-compatible speech-to-text fallback (`STT_API_KEY`, e.g. OpenAI or Groq
  Whisper) covers browsers without Web Speech; that audio is transcribed and
  immediately discarded, never stored.
- **Jot from anywhere** — a quick note from Slack, Raycast, or an iOS Shortcut
  appends to today's note and commits it.
- On ingest, Claude reads your daily notes to create/enrich wiki pages, generates
  recall cards from them, and writes each day's one-line summary.

### 📝 Docs
Google-Docs-style **persistent documents** for long-form writing that doesn't fit
a dated note.
- A formatting **toolbar** across the top (bold, headings, lists, quotes, code,
  tables) over a blank, letter-sized page in the app's theme.
- Rich text, inline **LaTeX** (`$e^{i\pi}+1=0$`), and images; autosaves back to
  the repo as you type.
- Each doc is a real wiki **source** at `sources/notes/<slug>.md`, so it gets
  compiled into the wiki on the next ingest like any other note.

### ✅ Tasks
A **git-backed task board** — every task is a file at `wiki/tasks/<id>.md`.
- Fields for **project, priority, status, due date**, and a `page_slug` link to
  the task's wiki project page; projects are color-coded on the board.
- Add, edit, and complete tasks from the web app, Slack, Raycast, or iOS
  Shortcuts — edits commit straight to GitHub via the Contents API.
- During ingest Claude keeps the board and your project pages in sync: open tasks
  for a project's next steps, mark finished ones done.

### 🗓️ Calendar
A **Notion-Calendar-style** view of your real calendars plus the agent's plan.
- Connect **Google Calendar** and/or **Outlook** with client-side OAuth — no
  server secrets, tokens stay in the browser.
- Sidebar mini-month with **day / week / month** views, and a dedicated **mobile
  layout** for iPhone.
- **"Planned" overlay** — during ingest Claude scopes your active projects' next
  steps into dated deliverables in `wiki/calendar/planned.json`, drawn as a
  distinct, **toggleable** layer so you see suggested timelines next to real
  events (never mixed in).

### 🧠 Recall (spaced repetition)
Turns your notes into daily active-recall questions and tracks retention with
**FSRS** — with **no API key in the web app**.
- The grading and card-writing happen in the **ingest** (which *is* the LLM):
  Claude generates atomic cards from what you wrote, grades the previous answers,
  and the FSRS engine schedules each card. All state is git-backed in `wiki/srs/`.
- **Today** shows the day's quiz; you answer, the app captures it, the next ingest
  grades it and advances the schedule.
- **Overview** shows a recall **dashboard**: true 30-day retention on graduated
  cards, review streak, a stability histogram, a 14-day due forecast, confidence
  calibration, and per-topic mastery.

## Quick start

```bash
git clone <this-repo> cortex
cd cortex/web
npm install
npm run dev            # → http://localhost:3000
```

It runs on the bundled **empty starter vault** (`examples/vault/`) out of the box —
the proper folder structure with just the starter files, ready to fill.

## Choose your vault

The app finds your content via `VAULT_PATH` (the directory that holds `sources/`
and `wiki/`). Pick one — a one-line helper writes it to `web/.env.local` for you:

**Option A — Use your own existing vault** (your Obsidian / Cortex setup):
```bash
node scripts/use-vault.mjs /path/to/your/obsidian-vault
cd web && npm run dev
```
Your vault just needs `sources/` and `wiki/` folders (see `CLAUDE.md` +
`examples/vault/` for the layout). Or set `VAULT_PATH` yourself.

**Option B — Start empty** (the default):
```bash
cd web && npm run dev        # runs on examples/vault, the empty starter
```
Then read [`examples/vault/README.md`](examples/vault/README.md) +
[`CLAUDE.md`](CLAUDE.md) and start writing into `sources/`.

> Want to see it populated first? There's a fully-worked fictional demo:
> `node scripts/use-vault.mjs examples/demo-vault`.

For write-back and deployment (committing edits from the app to GitHub), set
`GITHUB_TOKEN` + `GITHUB_REPO` — see [`web/.env.example`](web/.env.example) and
[`web/DEPLOY.md`](web/DEPLOY.md).

## Setup & integrations

Everything below is optional — the app works without any of it. Add the pieces you
want.

### 🗓️ Connect Google Calendar (and Outlook)

The Calendar tab uses **client-side OAuth** — no server, no secret, no token
database. You provide a **public** client ID and sign in per device. Quick version
(full steps + Outlook in [`web/CALENDAR.md`](web/CALENDAR.md)):

1. [Google Cloud Console](https://console.cloud.google.com/) → create/pick a project.
2. **APIs & Services → Library** → enable the **Google Calendar API**.
3. **OAuth consent screen** → *External* → add your Google account as a **Test user**
   (keeps it in "testing" mode — fine for personal use, no verification needed).
4. **Credentials → Create Credentials → OAuth client ID → Web application.** Under
   **Authorized JavaScript origins** add your exact origin(s):
   `https://<your-project>.vercel.app` and `http://localhost:3000`. *(No redirect
   URI needed.)*
5. Copy the Client ID and set it (Vercel → Environment Variables, then **redeploy**):
   ```
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=…apps.googleusercontent.com
   ```
6. Open the **Calendar** tab → **Connect Google** → sign in and grant access.

> **Getting `Error 403: access_denied`?** Your app is in *testing* mode and the
> Google account you're signing in with isn't a **Test user** yet — add it under
> *OAuth consent screen → Test users*. Also confirm the origin you're opening
> matches an **Authorized JavaScript origin** exactly (same scheme + host, **no
> trailing slash**). Changing origins? Google can take a few minutes to propagate.

### 📱 Install on iPhone (home-screen web app — the "bookmark" method)

The app is a PWA, so you can add it to your Home Screen as a full-screen app — no
App Store, just a bookmark that behaves like a native app:

1. Open your deployed URL (e.g. `https://<your-project>.vercel.app`) in **Safari**
   on your iPhone. *(Must be Safari — Add to Home Screen lives there.)*
2. Tap the **Share** button (the square with an up-arrow) → scroll down →
   **Add to Home Screen**.
3. Give it a name (e.g. "Wiki") → **Add**.

It gets its own icon and launches **full-screen (standalone)** with the dark
theme — no browser chrome, no tabs. For **one-tap capture** without even opening
the app (Action Button, Back Tap, Lock Screen, Siri, Share Sheet), add the iOS
Shortcuts in [`clients/shortcuts/`](clients/shortcuts/README.md).

### 💬 Set up the Slack bot yourself

A [Socket-Mode](https://api.slack.com/apis/socket-mode) Slack app turns
`/wiki <verb>` and `@mentions` into a **headless Claude run on your vault**, then
replies in Slack. Quick version (full walkthrough in
[`tooling/slackbot/README.md`](tooling/slackbot/README.md)):

1. Create a Slack app (https://api.slack.com/apps → *From scratch*).
2. **Socket Mode: on** → generate an **App-Level Token** (`xapp-…`, scope
   `connections:write`).
3. **Bot Token Scopes**: `app_mentions:read`, `chat:write`, `commands`,
   `channels:history`, `groups:history` → **Install to workspace** → copy the
   **Bot Token** (`xoxb-…`).
4. Add a **`/wiki` slash command** and subscribe to the **`app_mention`** event.
5. Install [Claude Code](https://claude.com/claude-code) on a machine that stays
   up (a server, a Pi) and sign in.
6. `cp tooling/slackbot/.env.example tooling/slackbot/.env`, fill in the two tokens
   + your `VAULT_PATH`, then run the bot and keep it alive (systemd / tmux).

> The runtime handler is a documented placeholder — the contract is simply
> "Slack event → `claude -p` in the vault → reply." Drop in your own Socket-Mode
> script, or ask and it can be vendored.

## Repository layout

```
web/                 Next.js web app (the main interface) — see web/README.md
clients/             Raycast extension + iOS Shortcuts
tooling/             The Slack bot (setup + env; see tooling/slackbot/README.md)
.claude/             Slash commands + instructions that drive Claude's wiki work
examples/vault/      Empty STARTER vault — proper structure + starter files (the default)
examples/demo-vault/ Fully-worked fictional demo (optional; safe to delete)
scripts/use-vault.mjs  Point the app at your own vault, the demo, or the starter
CLAUDE.md            The schema: how sources become the wiki (customize this)
```

## The demo vault

`examples/demo-vault/` is an optional, fully-worked fictional vault (a "Second
Brain CLI" project, ML pages, tasks, daily notes, and a live recall dashboard) —
handy for seeing every feature populated. View it with
`node scripts/use-vault.mjs examples/demo-vault`, or delete it if you don't want
it. Its spaced-repetition history is time-anchored; refresh it with
`node examples/seed-demo-srs.mjs`.

## License

MIT — see [LICENSE](LICENSE).
