# Deploy your own Cortex

The public GitHub Pages site is a static showcase. It deliberately cannot read a vault. Deploy the Next.js app separately for your own workspace.

## Local setup

Use Node.js 22+, `npm ci` in `web/`, then `npm run dev`. Default content is the empty `examples/vault`. From the repository root, `node scripts/use-vault.mjs /absolute/path/to/private-vault` selects your separate vault in a gitignored `.env.local`.

## Private hosting

1. Create your own private deployment project. Configure its root as `web/`, install with `npm ci`, build with `npm run build`, and start with `npm start` on a Node host.
2. Provide a vault directory explicitly through `VAULT_PATH`. The runtime must have access to that directory. For a serverless deployment, arrange an explicit private build/runtime copy and file tracing for your vault; the public template does not bundle arbitrary private paths automatically.
3. Set `APP_PASSWORD` to a strong secret, or configure Google login with `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `ALLOWED_EMAILS`, and `AUTH_SECRET`. Alternatively protect the whole application and its APIs with a trusted access proxy/deployment protection. Do not rely on hiding the URL.
4. Set `APP_ORIGIN` to the exact HTTPS origin. Never expose server secrets as `NEXT_PUBLIC_*` variables.
5. For hosted writes, set `GITHUB_TOKEN`, `GITHUB_REPO=your-name/your-private-vault`, and `GITHUB_BRANCH`. Use a fine-grained token restricted to that private data repository with Contents read/write. Without GitHub write-back, edits use the local filesystem and require persistent writable storage.
6. Check unauthenticated HTML, API reads, and assets before adding real notes. Server rendering is dynamic and does not load the vault for an unauthenticated visitor when login is enabled. Read and write routes check authentication. `API_TOKEN` enables authorized external clients; it is not a replacement for login.

Vault index reads use the configured local vault; GitHub write-back does not by itself synchronize the entire local checkout. Arrange a private sync/deployment mechanism if you need remote edits reflected in all index views.

## Calendar and Codex

See [calendar setup](CALENDAR.md) for Google and Microsoft OAuth, and [Codex companion setup](../tooling/cortex-codex-bridge/README.md) for agent replies and estimates. Configure your own clients, origin, and bridge secret. No developer account IDs or deployment credentials are included.

## Optional Convex mirror

Disabled by default. The query requires a verified Convex identity whose email is in its `ALLOWED_EMAILS` environment setting. You must configure a Convex authentication provider and client token integration before enabling `NEXT_PUBLIC_CONVEX_URL`. The app’s password session does not authenticate Convex. Do not remove the query guard to make it work with private data. The synchronization cron is opt-in.

## Publishing code safely

Keep personal data outside this repository. `.gitignore` excludes root vault folders, environment files, credentials, bridge state, and deployment metadata. `node scripts/check-public.mjs` checks tracked files for common secret patterns and disallowed paths. Review `git diff --cached` yourself before publishing: automated checks cannot prove that every piece of text is non-private.

The GitHub Pages workflow publishes only `site/`. Do not change the upload path to the repository root, `web/`, or any vault directory.
