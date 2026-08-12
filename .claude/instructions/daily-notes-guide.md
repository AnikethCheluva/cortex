# Daily Log

A running log of daily learnings — news, research, classes, ideas.

---

## How to add a new entry

1. Create a new file inside the `Daily/` folder named `M-D-YY.md` (e.g. `4-19-25.md`)
2. Copy the template below into it
3. Fill in each section — skip any that don't apply that day

### Template

```markdown
---
Date: YYYY-MM-DD
---

# #1 

# #2 

# #3 

# #4 
```

---

## Summaries (web viewer)

Each daily note gets a one-line summary shown as the subtext in the web viewer's
Daily list. Summaries are **generated at ingest** and stored in the wiki layer at
`wiki/daily-summaries.json` (keyed by the note's `M-D-YY` filename stem) — never
written into the source note itself. See step 7 of `/ingest`.

---

## Log Index

![[Daily Log.base]]
