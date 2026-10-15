# Cortex integration API

When login is enabled, data reads and writes require a session cookie or an explicit `Authorization: Bearer <API_TOKEN>`. The public local starter is unauthenticated by default. Protect hosted private data before connecting clients. See [deployment](DEPLOY.md).


A small HTTP API over the vault so **any frontend** (Raycast, iOS widgets /
Shortcuts, a native app, `curl`) can read state and capture notes/tasks. Every
endpoint reads/writes the git repo (the source of truth) through the same
GitHub-backed logic the web app uses — there is **no separate database**.

Base URL: `https://<your-project>.vercel.app`

## Auth

- With `APP_PASSWORD` or allowlisted Google login enabled, data reads and writes require a valid session cookie or explicit API bearer token.
- With login disabled, reads are open. `API_TOKEN` limits external writes; same-origin browser writes remain allowed. It is not full user authentication.
- Keep server tokens out of client bundles and URLs. See `.env.example` and `DEPLOY.md`.

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
