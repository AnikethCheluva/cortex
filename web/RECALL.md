# Daily recall quality and reliability

The morning agent grades existing submissions before generating new questions.
Use the exact `(card_id, submission_ts)` pair; never grade an unanswered card.
Read the stored source span, reference answer and required points. Accept
equivalent wording. Correct means all required points and no contradiction;
partial means some correct evidence with omissions; incorrect means no useful
support or a central contradiction. Keep a concise rubric assessment in the
ingest log. If the source/rubric is ambiguous or outdated, leave the answer
pending, repair or suspend the card with a reason, and report it.

Generate a few strong questions from new material and weakly covered topics.
Prefer explanation, comparison, application and error diagnosis to trivia.
Use self-contained **short_answer** or **conceptual** questions: the current
handoff does not carry the extra fields needed for valid MCQ/cloze cards.
Each requires a nonempty verbatim supporting source span, a reference answer,
explicit required points, a Bloom level and integer difficulty 1–5. Read the
actual `source_file` and verify the quote occurs there. Do not label a candidate
verified unless all six checks were performed; missing or nonboolean flags fail.
Check semantic duplicates as well as the engine's lexical duplicate check.
Never silently rewrite an existing card's meaning while keeping its memory state.

The engine keeps due reviews ahead of new material, even when seen yesterday;
it never penalizes missed days. New cards rotate by the New York calendar day
and are interleaved by topic before the daily cap, as are the final questions.
The defaults remain 20 total / 8 new / 90% target retention. Rerunning ingest
keeps an already published daily question set so a session does not move under
the user. Grade submissions chronologically. Invalid JSONL or verdicts stop the
run instead of silently dropping answers or turning typos into failed reviews.

Validate with `npm test -- lib/srs lib/changelog/srs.test.ts`. Before commit,
reconcile received/graded/pending answers, accepted/rejected/duplicate candidates,
selected IDs, and any warnings. A mostly-New deck or a growing pending queue
needs attention to grading, not just more new cards. On interrupted writes,
inspect reviews, card state and submissions before retrying; the multi-file SRS
writer is not a transactional database. Never replay an already applied review.
