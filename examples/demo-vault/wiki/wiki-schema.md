# Wiki schema — page rules

The spec every `wiki/pages/*.md` file follows. The wiki is **LLM-generated** from
`sources/`; don't hand-edit pages as notes — fix the source or regenerate.

## One concept per page
Each page is **atomic**: one concept, entity, project, or paper. If a page tries
to cover two things, split it. Filename is the slug: lowercase kebab-case
(`transformer-attention.md`), which is also how you `[[link]]` to it.

## Frontmatter (required)
```yaml
---
title: "Human-readable title"       # always double-quoted
summary: "One sentence, ≤200 chars" # always double-quoted (colons break YAML otherwise)
tags: [concept, topical, tags]      # first tag is the TYPE tag — see below
sources: [sources/daily/2026-08-11.md, sources/research/readings/foo.md]
updated: 2026-08-11                  # ISO date, bumped on every change
---
```
- **`title` and `summary` MUST be double-quoted** — an unquoted `:` in either is
  the most common cause of a broken build.
- **Every page cites its `sources:`** — no claim without a source. `sources` are
  paths under `sources/` (or URLs). A page with no source shouldn't exist.

## The Tagging rulebook
Every page gets **exactly one type tag, as its first tag**, then topical tags.
The type tag decides the page's **folder in the web viewer** (see
`web/lib/categories.ts`).

| Type tag | Use for | Example |
|---|---|---|
| `concept` | Durable, general knowledge that stands on its own | `spaced-repetition` |
| `project` | A named, ongoing effort *you* are pushing (goal + activity) | `example-project` |
| `paper` | A specific paper / article / talk | `attention-is-all-you-need` |
| `personal` | Goals, plans, reflections about you | `learning-goals-2026` |
| `hub` | A navigation / map page over a topic | `getting-started` |
| `school` | Coursework knowledge (if you track classes) | — |
| `archive` | Historical, no longer active | — |

Never use two type tags, and never invent an `entity` type. Topical tags after
the type tag are free-form (`ml`, `memory`, `tooling`, …).

### concept vs project (the common judgment call)
- **concept** = knowledge that still stands if you drop the project.
- **project** = your specific work — experiments, results, status, next steps.
  Project pages are living **dashboards** (Goal · Status · Workstreams · Results ·
  Open questions · Next steps · Related), not essays. Keep project-specific
  results OUT of concept pages; link the two instead.

## Linking
- Cross-link liberally with `[[slug]]` or `[[slug|display text]]`.
- Flag a contradiction with a callout instead of silently overwriting:
  `> [!warning] Stale — see <source>`.

## The catalog & log
- Add every new/changed page to `wiki/index.md` (one line).
- Append every operation to `wiki/log.md`: `## [YYYY-MM-DD] action | description`.
