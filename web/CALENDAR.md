# Calendar tab — connecting Google Calendar + Outlook

The **Calendar** tab connects to Google Calendar and Outlook/Microsoft 365 with
**client-side OAuth** (Google Identity Services + MSAL) and calls the Calendar
API / Microsoft Graph straight from the browser. There is **no server, no secret,
and no token database** — access tokens live in your browser only. You provide
two **public** client IDs as env vars; you sign in per-device.

You can set up either provider (or both) — the tab only shows the ones configured.

---

## 1. Google Calendar

Create a **Web application** OAuth client:

1. [Google Cloud Console](https://console.cloud.google.com/) → create/pick a project.
2. **APIs & Services → Library** → enable **Google Calendar API**.
3. **APIs & Services → OAuth consent screen** → External → add your Google account
   as a **Test user** (keeps it in "testing" mode — fine for personal use; no
   verification needed). Add the scope `.../auth/calendar` if prompted.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID** →
   **Web application**. Under **Authorized JavaScript origins** add your app origin(s):
   - `https://<your-project>.vercel.app`
   - `http://localhost:3000` (for local dev)
   *(No redirect URI needed — GIS uses the token model.)*
5. Copy the **Client ID** (`…apps.googleusercontent.com`).

Set it in Vercel (Production + Preview) and locally:
```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=…apps.googleusercontent.com
```

---

## 2. Outlook / Microsoft 365

Create a **SPA** app registration:

1. [Azure Portal](https://portal.azure.com/) → **Microsoft Entra ID → App registrations → New registration**.
2. Name it (e.g. `LLM Wiki Calendar`); **Supported account types**: *Accounts in
   any org directory and personal Microsoft accounts* (covers work + outlook.com).
3. **Redirect URI**: platform **Single-page application (SPA)** → add your origin(s):
   - `https://<your-project>.vercel.app`
   - `http://localhost:3000`
4. **API permissions → Add → Microsoft Graph → Delegated** → add `Calendars.ReadWrite`
   and `User.Read` (the default). (No admin consent needed for personal use.)
5. Copy the **Application (client) ID** from the app's Overview.

Set it:
```
NEXT_PUBLIC_MS_CLIENT_ID=00000000-0000-0000-0000-000000000000
```

---

## 3. Deploy + use

- Add the env var(s) in **Vercel → Settings → Environment Variables** (they're
  `NEXT_PUBLIC_`, so **redeploy** to bake them into the client).
- Open the **Calendar** tab → click **Google / Outlook connect** → sign in and grant
  calendar access. Events from all your calendars merge into the month/agenda view.
- **+ Event** creates on the chosen provider's primary calendar; click an event to
  open it in the provider or delete it.

## Troubleshooting

- **`Error 403: access_denied` (Google).** The OAuth consent screen is in
  *testing* mode and the account you're signing in with isn't listed as a **Test
  user**. Add it under *APIs & Services → OAuth consent screen → Test users*. (You
  do **not** need to publish/verify the app for personal use.)
- **`redirect_uri_mismatch` / `origin_mismatch`, or the popup closes instantly.**
  The origin you opened isn't an **Authorized JavaScript origin**. It must match
  **exactly** — same scheme + host, **no trailing slash** (`https://foo.vercel.app`,
  not `https://foo.vercel.app/`). Add both your Vercel URL and
  `http://localhost:3000`. Changes can take a few minutes to propagate.
- **Nothing happens / the Connect button is missing.** `NEXT_PUBLIC_*` vars are
  baked in at build time — set them in Vercel and **redeploy**. Locally, restart
  `npm run dev` after editing `.env.local`.
- **Blocked pop-up.** The provider sign-in opens a pop-up; allow pop-ups for your
  app's origin.

## Notes

- **Per-device sign-in.** Tokens are browser-local, so you authorize on each device.
  (A cross-device version would need a server token store — ask and I'll add the
  Convex-backed variant.)
- **Read/write scope.** Google `calendar`, Microsoft `Calendars.ReadWrite`.
- **Privacy.** No calendar data or tokens touch the server or git — it's all
  browser ↔ Google/Microsoft directly.
- Times are handled in UTC internally and rendered in your local timezone;
  multi-day events show on their start day in the month grid.
