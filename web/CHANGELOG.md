# Cortex daily changelog

`wiki/changelog/YYYY-MM-DD.json` is the versioned source of truth. One file per
**change day in America/New_York**, not the date of the note being edited. A
back-dated daily note carries its own `noteDate`. The existing `wiki/log.md`
remains a prose operation log and appears under Activity → Legacy log.

## Record contract (version 1)

A day contains `{version:1,date,timezone:"America/New_York",records:[]}`. Each
record contains `id`, ISO `timestamp`, `source` (`web`, `ingest`, `srs`), `runId`,
`surface`, `action`, `path`, and `title`. Surfaces: tasks, docs, daily, wiki,
recall, sources. Actions: created, updated, deleted, status_changed, run.

File records optionally include `before`/`after` metadata and `changedFields`.
Task metadata includes title, status, priority, due date, project, completion
stamp; body edits are flagged without copying the note text. Document metadata
includes title/folder. Daily edits include the target note date. Deletes retain
prior metadata. IDs are stable within an ingest run and retries merge by ID.

SRS `run` records carry `recall`: candidate received/rejected/duplicate/added
counts and decisions; matched grades, verdicts, ratings, and scheduling before/
after; selection IDs and its due/new split; bank size and pending answer count.
The changelog does not publish reference answers, rubrics, or user answer text.

## Producers

- Web writes to tasks, Docs, and daily notes commit the edited file and its audit
  record atomically through GitHub's Git Data API. Task status changes also append
  the prose log. A competing HEAD update triggers a fresh read and retry; the
  journal preserves both writers. Identical content produces no entry.
- Ingest: run `npm run changelog:ingest -- start` **before** mutations and
  `npm run changelog:ingest -- finish` after SRS and all vault edits, before commit.
  `VAULT_PATH` selects the checkout. An alternate Git index snapshots tracked,
  dirty, and new files; the user's real index is unchanged. Git tree differences
  generate the actual created/updated/deleted file list, with task transitions
  and document metadata derived from both trees. Renames are delete/create.
- SRS emits actual execution outcomes into the same daily file. Within an ingest
  it reuses the baseline run ID; standalone repeat summaries deduplicate by day
  and summary. The handoff files and changelog itself are excluded from the diff.

## Rendering and API

Activity defaults to the daily structured feed: date navigation, surface filter,
search, task/note links, and expandable recall details. The latest 30 days are
included in the build; `GET /api/changelog?date=YYYY-MM-DD` refreshes a day from
GitHub. Today is the default. Older dates remain accessible through this API and
the date selector. The endpoint requires a session or API token when login is enabled.

## Prototype limits

A Git tree diff captures **net** changes during one ingest. If an agent changes a
task twice inside that interval, it records the starting and ending states;
intermediate web transitions have separate atomic events. Renames are not inferred.
Local ingest/SRS writers must run serially. Local filesystem saves serialize and
roll back on errors, but cannot guarantee multi-file atomicity across a process
crash; production web saves use one Git commit. `finish` retains its baseline on
failure, so a retry merges the same stable IDs instead of duplicating entries.
`abort` removes only the ephemeral baseline, never the changed vault files.
