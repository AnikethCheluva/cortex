# Cortex — Raycast extension

Capture into the wiki and glance at its state without leaving the keyboard.
A thin client over the web app's HTTP API (`web/API.md`); **git stays the source
of truth** — every write commits a `.md` file, exactly like the web app.

## Commands

| Command | Mode | Does |
|---|---|---|
| **Jot to Today** | view | Append a line to today's daily note (`POST /api/jot`). |
| **Add Task** | view | Create a task — title, project, priority, due date (`POST /api/tasks`). |
| **Tasks** | view | Browse every task; mark done / in-progress / reopen (`GET /api/tasks`, `PATCH /api/tasks/{id}`). |
| **Wiki Overview** | menu bar | Persistent `12d · 13 open · 1!` item with top tasks + quick actions (`GET /api/overview`, refreshes every 30 min). |

## Setup

Prerequisites: the [Raycast](https://raycast.com) app and Node 18+.

```bash
cd clients/raycast
npm install
npm run dev      # loads the extension into Raycast in development mode
```

`npm run dev` registers the commands in Raycast and hot-reloads on save. On first
run, Raycast prompts for the extension's **preferences**:

- **App URL** — your deployed origin, e.g. `https://cortex.vercel.app`
  (or `http://localhost:3000` while developing the web app).
- **API Token** — leave blank unless you've set `API_TOKEN` on the server; then
  paste the same value so writes authenticate. Reads work without it.

To keep it after development, run `npm run build` and Raycast imports it locally
(no need to publish to the Raycast Store for personal use).

## Tips

- **Menu bar**: after the first run, *Wiki Overview* appears as a menu-bar item.
  Toggle it in Raycast → Extensions → Cortex → Wiki Overview.
- **Hotkeys**: bind *Jot to Today* to a global hotkey (Raycast → Extensions →
  record a shortcut) for capture-from-anywhere.
- The menu-bar dropdown has ⌘J (jot) and ⌘N (add task) shortcuts.

## Regenerating the icon

`assets/icon.png` is generated (no binary asset to hand-edit):

```bash
node assets/make-icon.mjs
```
