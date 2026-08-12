---
description: Compile a source (URL or sources/ file) into the wiki — create/update concept pages, cite, cross-link, index, log
argument-hint: <url | sources/ path | empty = sweep sources>
---

Ingest into the wiki: $ARGUMENTS

Follow the **Building/updating the wiki from a source** workflow in `CLAUDE.md` and the page rules in `wiki/wiki-schema.md`:

1. **Resolve the source.**
   - If `$ARGUMENTS` is a URL: save the raw capture into the right `sources/<area>/` with a dated filename (`YYYY-MM-DD-topic.ext`), then read it.
   - If it's a path under `sources/`: read it directly.
   - If empty: read `wiki/index.md`, then sweep `sources/` for material not yet represented in the wiki and ingest the most significant gaps.
2. Read `wiki/index.md` to see what pages already exist.
3. For each concept/entity the source touches, create or update `wiki/pages/<slug>.md` (lowercase kebab-case). Apply the schema frontmatter (`title`, `summary`, `tags`, `sources`, `updated`) and list every contributing source under `sources:`. Cross-link related pages with `[[wikilinks]]`. Aim for 5–15 pages touched.
   - **Tags: follow the Tagging rulebook in `wiki/wiki-schema.md`.** Give every page exactly **one type tag as its first tag** (`concept` / `project` / `paper` / `school` / `personal` / `hub` / `archive`) — it decides the page's folder in the web viewer — then topical tags. `concept` = durable knowledge; `project` = an emergent strand of your own work. Never use `entity` or a second type tag.
4. **Project manager — detect, route, and maintain project pages (enforced).** Don't just compile concept knowledge; act as your **project manager**: keep an accurate, living picture of the named efforts you are actively working on, and route each piece of work to the right place. Every ingest:

   **a. Know the active projects.** Before filing anything, build a quick roster so you recognize them in the source: (1) existing `project`-tagged pages in `wiki/index.md`; (2) the task board — cluster `wiki/tasks/*.md` by their `project:` field and shared name prefixes; (3) recurring named efforts in recent daily notes. A **project** = a named, ongoing workstream *you are pushing* — an experiment thread, an implementation, a sweep/run series, a build — with a goal and continued activity, often a codename (e.g. a tool you are building). A **concept** = durable general knowledge that still stands if you drop the project. (Full litmus + detection signals: the Tagging rulebook in `wiki/wiki-schema.md`.)

   **b. Route content to the right layer — projects ≠ concepts.** For each thing the source touches, decide: *general knowledge* or *your specific work on a project*?
   - **General method / idea / landscape** → the **concept** page. Concept pages hold **no** project-specific experiments, results, status, or next-steps.
   - **Your specific effort** (a named experiment, a sweep, an implementation you are running — its setup, results, decisions, next steps) → the **project** page. **Create** one (tagged `[project, …]` → Projects folder) when the strand *recurs or is clearly being pursued and has no page yet*; **enrich** the existing project page otherwise. Cite the daily-note source(s).
   - **Fix mis-filing — the common failure to correct.** If an active project's work is buried inside a *concept* page (e.g. a tool you are building and its sweeps sitting inside the related tokenization *concept* page), **extract it into that project's page** and leave a one-line `[[project-page]]` link in the concept. The concept keeps the general idea; the project owns your work on it. Actively watch for this on every ingest.

   **c. Maintain each project page as a living dashboard** — a PM view, not an essay. Keep these sections current (add any that are missing): **Goal** (one-line thesis + why it matters), **Status** (active / blocked / paused, with a dated one-liner), **Workstreams / experiments** (each sub-thread and what it's testing), **Results & decisions** (dated findings), **Open questions**, **Next steps** (concrete and actionable), and **Related** (`[[concept pages]]` it builds on + its `wiki/tasks/` items). Bump `updated:`. Model the shape on the example project page `wiki/pages/example-project.md`.

   **d. Reconcile with the task board.** Projects and tasks are two views of the same work: every active project's concrete next steps should exist as `wiki/tasks/*.md` items (create missing ones with the right `project:` slug and a `page_slug` link to the project page); mark completed steps done; keep the project page's Next-steps and the board consistent. When a strand graduates from idea → active work, both create its project page and open its first task(s).

   **e. Scope active project timelines onto the calendar (planned deliverables).** Beyond tracking tasks, act as a **planner**: translate each active project's Next-steps / workstreams into a **dated timeline** the web calendar overlays as a distinct, toggleable **"Planned"** layer (brass, dashed — clearly the agent's suggestions, not real events). Maintain **`wiki/calendar/planned.json`**, a git-backed calendar the agent owns:
       `{ "events": [ { "id": "<project>-<slug>", "title": "<project>: <deliverable>", "date": "YYYY-MM-DD", "allDay": true, "project": "<project-slug>", "page_slug": "<wiki project page>", "kind": "deliverable|milestone|review|checkpoint", "note": "<one line>", "source": "<sources/… file>", "createdAt": "<today>" } ] }`
     - **Ground every date.** Only schedule deliverables that follow from what the sources actually say you are doing; infer realistic targets from **today's date**, the project's cadence, and any real deadlines in the notes (paper/submission dates, demos, semester milestones). Prefer near-term, actionable checkpoints (next 1–8 weeks) over vague far-future dates; when a hard deadline exists, anchor to it and **back-plan** the checkpoints before it.
     - **Decompose.** A milestone becomes a short ordered sequence of dated checkpoints (e.g. "spec done" → "baseline eval" → "writeup / submit"), not one lump — that is the "scope out the timeline" job.
     - **Idempotent + stable ids.** Reuse a stable `id` per deliverable; update an existing entry's date/title rather than adding a duplicate. Remove entries whose task is `done` or that are clearly abandoned. Keep the file a current, de-duped picture — roughly a dozen or two live deliverables across active projects, not an ever-growing dump.
     - **Reconcile with the board.** Each planned deliverable should line up with a `wiki/tasks/*.md` item where one exists (same `project` slug; the calendar `date` = the task's `due_date`); create the task when the deliverable is concrete and missing.
     Only scope genuinely active projects; skip for pure concept ingests with no project work. Commit `wiki/calendar/` with the run (step 10d).

   Be **judicious about creating** project pages (committed / recurring efforts only, so Projects stays signal-rich) but **liberal about enriching, routing, extracting, reconciling, and scheduling**.
5. Flag contradictions with a `> [!warning] Stale — see <source>` callout; never silently overwrite.
6. Update `wiki/index.md` entries and bump `updated:` dates.
7. Append to `wiki/log.md`: `## [YYYY-MM-DD] ingest | <source>` — note any project pages created/enriched.
8. **Daily-note summaries.** For every daily note the ingest touches (and any in `sources/daily/` still missing one), (re)generate a concise one-line summary — ≤100 chars, plain text, what the day covered — and write it to `wiki/daily-summaries.json` keyed by the note's filename stem (e.g. `"6-29-26"`). This is the subtext shown in the web viewer's Daily list. Summaries live in the wiki layer — never write them into the source note.
9. **Update the knowledge graph** so it reflects the new pages (see the graphify section in `CLAUDE.md` — rebuild via the `graphify` skill when several pages changed).
10. **Recall quiz — spaced-repetition question bank (grading + card-writing happen HERE, because the ingest is you, Claude; the web app holds no API key).** This turns the user's notes into daily active-recall questions and tracks retention over time. All state is git-backed under **`wiki/srs/`**:
    - `cards.json` — the card bank: `{ "<id>": { stem, reference_answer, required_points[], source_span, topic, source_file, type, bloom, difficulty_target, srs:{FSRS state}, verification } }`.
    - `reviews.jsonl` — append-only log of every graded answer (the source of truth for stats).
    - `submissions.jsonl` — raw, **ungraded** answers the web app queued (`{ card_id, ts, user_answer, confidence, duration_ms }`).

    You do three things — grade, generate, run the engine. **Do not** edit `cards.json`/`reviews.jsonl` by hand or compute any FSRS/scheduling yourself; only the engine (step 10c) touches those.

    **10a. Grade the pending answers.** For every entry in `wiki/srs/submissions.jsonl`, load its card from `cards.json` and grade `user_answer` **strictly** against that card's `reference_answer` + `required_points`:
    - `correct` **only if every required point is present** — judge *meaning*, so paraphrases / synonyms / different wording are fine;
    - `partial` if some but not all required points are present;
    - `incorrect` otherwise (blank included).

    Be strict (LLM graders drift lenient): a vaguely-related answer is **not** correct, and extra unsupported claims earn nothing. Append one line per graded answer to **`wiki/srs/_grades.jsonl`**:
    `{"card_id":"<id>","submission_ts":"<the submission's ts>","verdict":"correct|partial|incorrect"}`

    **10b. Generate new cards** from the material you ingested this run (if little changed, draw from the wiki pages least-covered by existing cards). Append one JSON object per line to **`wiki/srs/_newcards.jsonl`**:
    `{"stem":"…","reference_answer":"…","required_points":["…"],"source_span":"<verbatim quote from the source>","type":"short_answer|cloze|mcq|conceptual","bloom":"remember|understand|apply|analyze|evaluate","difficulty_target":1-5,"source_file":"wiki/pages/<slug>.md","topic":"<short topic>","verification":{"answerable_from_span":true,"reference_correct":true,"answer_leak":false,"ambiguous":false,"trivial":false,"answerable_without_source":false}}`

    Card-writing rules (evidence-based — active recall + desirable difficulty):
    - **Atomic** — one fact per card; the answer is a single unambiguous word / phrase / number / short statement. Split compound facts into separate cards.
    - **Grounded** — `source_span` is a **verbatim** quote from the source that fully supports `reference_answer`; the card must be answerable from that span alone.
    - **No leakage** — never put the answer (or an obvious synonym) in the `stem`; no yes/no questions; prefix a short topic cue so the card stands alone out of context.
    - **Non-trivial** — skip generic trivia answerable without *these* notes; skew toward `understand`/`apply`. For STEM prefer "state / derive / explain why" over blanking one symbol; handle LaTeX carefully.
    - `required_points` = the atomic facts a correct answer MUST contain (this is the grading rubric used in 10a). Set the six `verification` flags **honestly** — the engine drops any card whose gate fails (`answerable_from_span` & `reference_correct` must be true; `answer_leak`/`ambiguous`/`trivial`/`answerable_without_source` must be false). A few strong cards per substantive note — not an exhaustive dump.

    **10c. Run the engine:** `cd web && npm run srs:ingest` (needs web deps once: `cd web && npm ci`). It applies the grades (verdict → FSRS grade `correct`=Good/`partial`=Hard/`incorrect`=Again → advances each card's schedule → appends to `reviews.jsonl`), merges the gated + deduped new cards into `cards.json`, clears `submissions.jsonl` and both handoff files, and selects the day's due-for-review + new cards into today's daily note behind `<!-- srs:quiz -->`. Tuning via env: `QUIZ_DAILY_CAP` (default 20), `QUIZ_TARGET_RETENTION` (default 0.9). On the first run the bank is empty, so there's nothing to grade — it just generates + selects.

    **10c-bis. Unanswered / missed days (keep the schedule honest).** A card the user *doesn't* answer is **never penalized** — the engine only grades answers actually present in `submissions.jsonl`, so a skipped card's memory state is untouched: it **stays due and carries forward**, resurfacing on the next selection **most-at-risk first** (lowest recall probability). Missed reviews accumulate as a backlog, and the daily selection gives **reviews priority over new cards**, so a backlog **gates new material** (adding new cards while behind only deepens the hole); new-card introduction resumes automatically once caught up. **Never hand-write an `Again`/`incorrect` grade for a card the user simply didn't answer** — a missed review is not a lapse, and faking one corrupts FSRS stability. (The web app's **Today** page also **live-selects** the same due + new set whenever that day has no `<!-- srs:quiz -->` block yet, so there's always a quiz even on a day the ingest hasn't run.)

    **10d. Commit + push the recall + planning outputs immediately** — from the vault root: `git add wiki/srs wiki/calendar sources/daily && git commit -m "srs: daily recall quiz + planned deliverables" && git push`. This is **required**: `wiki/srs/` (and any `wiki/calendar/planned.json` from step 4e) are written locally, and if left uncommitted the next git sync (pull/reset) discards them — the quiz + planned events then never reach the web app. (The engine writes local files only; it never pushes on its own.) After this, the quiz shows on the web app's **Today** page and recall stats on **Overview**.
11. Report which pages you created vs. updated (call out new/enriched project pages), and the quiz result (`N` graded, `M` new cards, `K` selected for today).

Never write synthesis into `sources/` — only raw captures go there (daily-note summaries go in `wiki/daily-summaries.json`, not the notes).
