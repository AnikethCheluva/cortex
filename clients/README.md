# clients/ — native front doors to the wiki

Thin clients over the web app's HTTP API (`web/API.md`). They don't have their
own storage: **git is the source of truth**, and every write commits a `.md`
file through the same endpoints the web app uses. The web app stays the primary
interface; these are for fast capture and glanceable status.

| Client | Platform | What it adds |
|---|---|---|
| [`raycast/`](./raycast) | macOS (Raycast) | Menu-bar overview + Jot / Add Task / Tasks commands, hotkey-bindable. |
| [`shortcuts/`](./shortcuts) | iPhone/iPad | Siri, Action Button, Lock-Screen, and Share-Sheet capture — zero code. |

## One-time server setup: `API_TOKEN`

Reads (`GET`) are open; writes (`POST`/`PUT`/`PATCH`) are open **too** until you
set an `API_TOKEN`. For clients that live outside the browser, set one so casual
external writes are gated:

1. Generate a secret, e.g. `openssl rand -hex 24`.
2. Vercel → project → Settings → Environment Variables → add `API_TOKEN`
   (Production + Preview) → redeploy.
3. Put the same value in each client (Raycast preference / Shortcut header).

The web app's own same-origin writes keep working without it. See `web/API.md`
for the full endpoint reference and the auth model.

## Endpoints these clients use

- `GET /api/overview` — streak, task stats, top tasks, counts (menu bar / widgets).
- `GET /api/tasks` — every task (task list).
- `POST /api/jot` — append a line to today's note.
- `POST /api/tasks` · `PATCH /api/tasks/{id}` — add / update a task.
