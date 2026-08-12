# Slack bot — conversational front door

A small [Socket-Mode](https://api.slack.com/apis/socket-mode) Slack app that turns
`/wiki <verb>` and `@mentions` into a **headless Claude Code run on the vault**,
then posts the reply back to Slack. It's the quick, conversational door to the
wiki (pull info, jot a note into the day's note, trigger an ingest) — for a big
editing session, use the web app instead.

```
Slack message  →  bot  →  claude -p "<prompt>"  (cwd = the vault)  →  reply to Slack
```

The bot pulls the latest git state before each run and commits/pushes changes
back, so everything flows through normal git sync.

## Setup

1. **Create a Slack app** (https://api.slack.com/apps → *From scratch*).
   - **Socket Mode**: on → generate an **App-Level Token** (`xapp-…`) with
     `connections:write`.
   - **Bot Token Scopes**: `app_mentions:read`, `chat:write`, `commands`,
     `channels:history`, `groups:history`. Install to the workspace → copy the
     **Bot Token** (`xoxb-…`).
   - **Slash command** `/wiki` → any request URL (Socket Mode delivers events;
     the URL is unused).
   - **Event Subscriptions**: subscribe to `app_mention`.
2. **Install [Claude Code](https://claude.com/claude-code)** on the host and sign
   in, so the bot can shell out to `claude`.
3. **Configure** — copy `.env.example` to `.env` and fill in the tokens + the
   absolute path to your vault checkout.
4. **Run** it on a machine that stays up (a server, a Pi, a spare box):
   ```bash
   python3 -m venv .venv && ./.venv/bin/pip install slack-bolt
   ./.venv/bin/python wiki_slackbot.py
   ```
   Keep it alive with a process supervisor (systemd, tmux + a keepalive loop, etc.).

## Notes

- The bot injects the Slack `channel_id` / `thread_ts` into each prompt so Claude
  can pull prior-message context via the Slack MCP.
- Keep the bot **interface-only** — no crons or scheduled ingests here. Run
  scheduled compilation from a separate automation if you want it.
- `.env` and `.venv/` are gitignored — never commit tokens.

> The runtime script (`wiki_slackbot.py`) is intentionally not vendored here yet.
> Drop your implementation in this folder, or wire the flow above to your own
> Socket-Mode handler; the contract is just "Slack event → `claude -p` in the
> vault → reply."
