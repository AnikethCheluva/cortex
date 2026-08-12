---
title: "Spaced repetition"
summary: "Reviewing material at expanding intervals timed to the moment you are about to forget, so each recall is effortful and durable."
tags: [concept, learning, memory, srs]
sources: [sources/daily/2026-08-09.md, sources/daily/2026-08-10.md]
updated: 2026-08-10
---

**Spaced repetition** schedules reviews at increasing intervals — a day, then a
few days, then weeks — timing each one to just before you would forget. The
effortful recall at that edge is what makes the memory stick (the *spacing
effect* + *retrieval practice*).

## Why it works
- **Retrieval practice** — recalling a fact strengthens it far more than
  re-reading it. The question, not the answer, does the work.
- **Desirable difficulty** — a review that is a little hard produces more
  durable learning than an easy one.
- **Forgetting curve** — memory decays predictably; a review resets and flattens
  the curve, so the next interval can be longer.

## FSRS
Modern schedulers use **FSRS** (Free Spaced Repetition Scheduler), which models
each card's *stability* (how long the memory lasts) and *difficulty*, and picks
the next interval to hit a target recall probability (e.g. 90%). This wiki's
recall system is an FSRS implementation — see [[example-project]].

## Measuring it
The metric that matters is **true retention on graduated cards** — the pass rate
on cards you have seen more than once — not raw quiz accuracy. Tracking stability
growth and a due-forecast tells you whether the schedule is actually working.

## Related
- [[example-project]] — the CLI that generates and schedules the cards
- [[learning-goals-2026]] — where this fits the year's goals
