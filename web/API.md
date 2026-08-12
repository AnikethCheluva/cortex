# Cortex — Integration API

A small HTTP API over the vault so **any frontend** (Raycast, iOS widgets /
Shortcuts, a native app, `curl`) can read state and capture notes/tasks. Every
endpoint reads/writes the git repo (the source of truth) through the same
GitHub-backed logic the web app uses — there is **no separate database**.

Base URL: `https://<your-project>.vercel.app`

## Auth

- **Reads (`GET`)** are open.
- **Writes (`POST`/`PUT`/`PATCH`)**: if `API_TOKEN` is set in the environment,
  external clients must send it:
  ```
  Authorization: Bearer <API_TOKEN>
  ```
  The web app's own same-origin requests are allowed without it. If `API_TOKEN`
  is unset, writes are open (default).

  > This is a lightweight gate for a personal, login-less tool — it stops casual
  > external writes, not a determined attacker (the public web UI can write too).

## Endpoints

### `GET /api/overview`
One glanceable snapshot — ideal for a widget or menu bar.
```jsonc
{
  "today":  { "stem": "7-24-26", "label": "Thursday, July 24, 2026", "exists": true },
  "streak": 12,
  "tasks":  { "total": 19, "open": 13, "done": 6, "overdue": 1, "high": 3, "inProgress": 1,
              "top": [ { "id": "...", "title": "...", "project": "example-project",
                         "priority": "high", "status": "todo", "due_date": "" } ] },
  "counts": { "pages": 54, "tasks": 19, "daily": 40 },
  "generatedAt": "2026-07-24T15:00:00.000Z"
}
```

### `POST /api/jot`  — quick capture into today's note
```bash
curl -X POST https://<app>/api/jot \
  -H "Authorization: Bearer $API_TOKEN" -H "Content-Type: application/json" \
  -d '{"text":"idea: weight fingertip tokens by chunk velocity"}'
# → { "ok": true, "stem": "7-24-26" }
```
Appends the line to today's written notes (leaves the voice-notes section intact).

### `GET /api/tasks`  — list every task
```jsonc
{ "tasks": [ { "id": "run-14-task-dataset-on-pi05", "title": "…", "status": "todo",
              "priority": "high", "project": "example-project", "due_date": "",
              "tags": [], "page_slug": "", "body": "…" } ] }
```
Returns all tasks (todo / in_progress / done) for a full task list in any client.

### `POST /api/tasks`  — add a task
```bash
curl -X POST https://<app>/api/tasks \
  -H "Authorization: Bearer $API_TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Run 14-task dataset on pi05","project":"example-project","priority":"high"}'
```

### `PATCH /api/tasks/{id}`  — update status / priority / notes
```bash
curl -X PATCH https://<app>/api/tasks/run-14-task-dataset-on-pi05 \
  -H "Authorization: Bearer $API_TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"done"}'
```

### `GET /api/daily/{stem}` · `PUT /api/daily/{stem}`
Read or overwrite a day's note (stem = `M-D-YY` or ISO). `GET /api/daily/today`
reports the canonical current day.

### `POST /api/transcribe`  — audio → text
Multipart form-data with an `audio` file → `{ text }` (see the STT env vars).

## Client snippets

**iOS Shortcuts** — "Get Contents of URL": method `POST`, header
`Authorization = Bearer <token>`, request body JSON `{ "text": "Shortcut Input" }`
to `/api/jot`. Add to Home Screen for one-tap capture.

**Scriptable widget** — `await new Request(url)` against `GET /api/overview`
(add the header if `API_TOKEN` is set), then render streak / open tasks / today.

**Raycast** — thin commands that `fetch()` `POST /api/jot`, `POST /api/tasks`,
and `GET /api/overview`; store the token in the extension's preferences.
