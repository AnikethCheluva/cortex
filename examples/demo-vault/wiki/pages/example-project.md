---
title: "Second Brain CLI"
summary: "A command-line tool that turns daily notes into spaced-repetition flashcards and schedules them with FSRS."
tags: [project, tooling, srs, active]
sources: [sources/daily/2026-08-09.md, sources/daily/2026-08-10.md, sources/daily/2026-08-11.md]
updated: 2026-08-11
---

> This is the model **project page** — a living dashboard, not an essay. New
> project pages should follow this shape.

## Goal
Turn the notes I write every day into durable memory: extract atomic facts,
generate good recall questions, and schedule them so I actually retain what I
learn. One-line thesis: *notes you never revisit are notes you never learned.*

## Status
**Active** · 2026-08-11 — card generation works end-to-end; the FSRS scheduler is
half-built (the [[implementing task|implement-fsrs-scheduler]] is in progress).

## Workstreams / experiments
- **Ingest** — parse a day note, pull atomic facts, emit candidate cards. *Working.*
- **Scheduler** — FSRS state per card (stability, difficulty, due date). *In progress.*
- **Review loop** — present due cards, grade the answer, advance the schedule. *Next.*

## Results & decisions
- **2026-08-10** — first end-to-end round: 8 cards generated, 6 recalled. Card
  quality matters more than quantity — one atomic fact per card.
- **2026-08-09** — chose FSRS over SM-2: it models stability directly and targets
  a retention probability, which is the number I actually want to control.

## Open questions
- How strict should grading be? Lenient grading inflates retention and hides gaps.
- What is the right daily cap so reviews stay a habit and not a chore?

## Next steps
- Finish the FSRS scheduler (state transitions: New → Learning → Review → Relearning).
- Benchmark **true 30-day retention** on graduated cards — see [[spaced-repetition]].

## Related
- [[spaced-repetition]] — the method this implements
- [[learning-goals-2026]] — the goal it serves
- Tasks: `implement-fsrs-scheduler`, `benchmark-recall-retention`, `draft-project-spec`
