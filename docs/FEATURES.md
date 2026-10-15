# Cortex feature guide

## Capture, organize, and learn

Today offers one-column daily capture and a compact task list. Overview retains cards and customizable widgets. Voice capture uses browser speech recognition where available, with an optional OpenAI-compatible transcription service. Browser speech processing may use the browser vendor’s servers; it is not guaranteed to stay on-device.

Docs offers a paper-like editor with rich formatting, Markdown persistence, inline/display LaTeX, and folder organization. Wiki is a read-only presentation of compiled knowledge with backlinks, tags, source references, curated folders, and a flat alphabetical index. The header’s Curated/All pages segmented control controls browsing; global search is the single search entry. The live page count is plain text above the divider.

Recall supports daily quizzes, reference answers, measurements, and FSRS scheduling through the ingest tools. Activity records changes and renders relevant diffs. Notion import preserves imported material as source captures.

## Calendar and tasks

Connect Google Calendar or Microsoft Outlook using your own OAuth client IDs. Settings includes reconnect controls and explicit failure states. Provider availability, permissions, and browser popup rules still apply.

Desktop offers day, rolling three-day, week, month, and agenda views. Horizontal movement scrolls continuously and settles on day boundaries. Cached ranges preserve events while new dates load. Color controls are compact; events with detected meeting links offer Join meeting on desktop and in the mobile bottom sheet.

On a phone, the month title opens a compact dropdown above the timeline. Scroll vertically in week increments; the title tracks the month being browsed. Closing it restores the timeline month. Selecting a date navigates the timeline. Calendar-source controls sit beside the month. The event sheet blurs the backdrop and hides the bottom navigation. The compact Today control shows today’s day number. There is no separate event-search box or Jump to date input.

Tasks have priority, status, due date, project/tags, and estimated duration. The Tasks page offers list/board views, sorting and filters, a blue add button, and an Auto timebox action. The planner asks Codex for missing duration estimates, then fits timed blocks around existing busy periods. It respects explicit deadlines and reports unscheduled work when capacity is insufficient. For undated work it derives a due date from available schedule capacity. The current planning window is 14 days; AI estimates are suggestions, not guarantees. Review the resulting plan and adjust when needed.

## Agent and Command-K

The Agent tab has separate saved conversations, desktop chat history, and a Chats button to the left of the centered mobile title. The compact composer has a context-plus button, title-truncated wiki attachments, and an icon-only send action. Pin wiki pages from the Wiki reader or select them in the composer. Replies remain attached to their originating conversation.

Command-K combines search and quick agent questions. Intent detection chooses ordinary search or an agent prompt, and the answer appears in the same overlay. Supported app commands include timeboxing; arbitrary natural-language commands are not unrestricted shell access.

Context is bounded: the Agent uses selected wiki excerpts and task context; Command-K can include relevant wiki, recent daily notes, and open tasks. Those excerpts are sent to Codex when you ask. Browser chat history is local to that browser. Companion-side conversation state stays on the machine running the bridge. Neither is an automatic cross-device chat backup.

## Appearance and accessibility

Apple Dark is the default; Apple Light is available alongside Dune, Sage, Graphite, Nord, Mono, Parchment, and Daylight. Shared system typography, radius tokens, subtle glass surfaces, and responsive layouts unify the workspace. The document equation renderer retains mathematical typography. Focus treatment remains visible for keyboard navigation, with reduced-motion and reduced-transparency handling.

Mobile uses one centered page title, a floating global search button, and floating navigation. The More menu is navigation-only. Navigation hides while editing text fields or contenteditable areas so the keyboard and active input have room.

## Optional services

Calendar OAuth, Codex, Notion, remote transcription, GitHub write-back, and Convex each need independent configuration. The core local starter requires none of them. Raycast, iOS Shortcuts/widgets, and Slack capture clients remain available; configure their endpoints and secrets for your own instance. See the guides in `clients/`, `tooling/`, and `web/`.

### Manual task timeboxing

Drag a time range on the calendar, choose **Task**, search your existing task list, and select **Schedule task**. The selected duration becomes the task’s time estimate and it appears as a timed task block. Existing deadlines stay intact; tasks without deadlines receive the block’s end date. Scheduling a planned task moves its existing block. No external calendar connection is required.

The Tasks page shows **Planned** or **Unplanned** and includes matching filters. Automatic timeboxing skips already planned tasks and schedules around their blocks. Choose **Event** in the same dialog to create an external calendar event when a calendar is connected.
