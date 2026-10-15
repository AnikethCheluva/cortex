# Cortex Codex companion

The optional companion connects Cortex to a local, signed-in `codex app-server`. It supports wiki-grounded conversation, independent chat threads, and structured task-duration estimates. It requires Node.js 22+ and the Codex CLI on the machine running it.

The integration uses the official [Codex App Server protocol](https://developers.openai.com/codex/app-server/). Sign into Codex with your own eligible account; your Codex usage limits apply. This does not turn a ChatGPT subscription into API credits. No account token is copied into Cortex or the browser.

## Local use

1. Install the Codex CLI and sign in with `codex login`. Verify it works independently.
2. Generate a random bearer secret with `openssl rand -hex 32`. Store it privately.
3. Start the companion from this repository root:

```sh
export CORTEX_BRIDGE_TOKEN='your-generated-secret'
export CORTEX_CODEX_BIN="$(command -v codex)"
export CORTEX_ALLOWED_ORIGIN='http://localhost:3000'
node tooling/cortex-codex-bridge/server.mjs
```

4. In `web/.env.local`, set `CODEX_BRIDGE_URL=http://127.0.0.1:4317`, `CODEX_BRIDGE_TOKEN` to the same secret, and `APP_ORIGIN=http://localhost:3000`. Restart the web app.

Optional variables: `CORTEX_CODEX_MODEL`, `CORTEX_BRIDGE_STATE_DIR`, and `PORT` (default 4317). The machine must stay awake while handling requests. The state directory stores conversation metadata; keep it private.

## Hosted app

A hosted web server cannot reach your laptop’s localhost. Use a protected HTTPS tunnel or private network to the companion, set `CODEX_BRIDGE_URL` on your server, and keep the bearer token server-only. Set `CORTEX_ALLOWED_ORIGIN` and `APP_ORIGIN` to your app’s exact origin. Protect the web deployment separately with authentication/access control.

The optional macOS installer supports Cloudflare tunnel + Vercel reconnection. It requires `node`, `npx`, `codex`, `cloudflared`, and a signed-in Vercel CLI. Before running `node tooling/cortex-codex-bridge/install.mjs`, set your own `CORTEX_ALLOWED_ORIGIN`, `CORTEX_PRODUCTION_DOMAIN`, `CORTEX_VERCEL_PROJECT`, and `CORTEX_VERCEL_SCOPE`. It writes private configuration under `~/Library/Application Support/Cortex Codex Bridge/` and prints a LaunchAgent plist path. Load it with `launchctl bootstrap gui/$(id -u) <printed-plist-path>` if you want it at login. The reconnection helper updates your Vercel project’s bridge environment and triggers deployments. It does not provide permanent tunnel uptime. Use a stable named tunnel for production when possible.

Never commit `bridge-config.json`, connection files, bearer secrets, Codex credentials, or logs. The public installer has no preselected deployment.

## Data and capabilities

The web server sends the prompt plus bounded context excerpts selected by Cortex. The companion disables shell, web search, apps, and plugins, and runs its app-server in a private state directory. It answers or estimates; Cortex’s own planner performs scheduling. Treat estimated duration and generated answers as suggestions to review.

Chat history in the UI is browser-local. Companion conversations persist separately by conversation ID. This is designed for one person’s private deployment, not a multi-user hosted service.

```sh
node --test tooling/cortex-codex-bridge/*.test.mjs
```
