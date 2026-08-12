// Optional shared-secret gate for the write/action API so *any* external
// frontend (Raycast, an iOS widget/Shortcut, a native app, curl) can integrate
// safely. Honest scope: the web app is a public browser SPA with no login, so
// its own endpoints are inherently reachable by anyone who loads the site — this
// token is NOT user auth. What it does: when API_TOKEN is set, an external
// (cross-origin / non-browser) writer must present it, while the site's own
// same-origin browser requests keep working without it. It stops casual/
// accidental external writes, not a determined attacker.
//
// Applied to WRITE methods only (POST/PUT/PATCH/DELETE); GET reads stay open so
// widgets can pull freely and the browser's GETs (which don't send Origin) work.

export function apiAuthorized(req: Request): boolean {
  const token = process.env.API_TOKEN || "";
  if (!token) return true; // unconfigured → open (preserves current behavior)

  // 1) explicit token from an external client
  const auth = req.headers.get("authorization") || "";
  if (auth === `Bearer ${token}`) return true;
  if (req.headers.get("x-api-token") === token) return true;

  // 2) same-origin browser request (the web app). Browsers send an Origin
  //    header on non-GET fetches; match it to this deployment's host.
  const origin = req.headers.get("origin") || req.headers.get("referer") || "";
  const appOrigin = process.env.APP_ORIGIN || "";
  if (appOrigin && origin.startsWith(appOrigin)) return true;
  try {
    const host = req.headers.get("host");
    if (host && origin && new URL(origin).host === host) return true;
  } catch {
    /* malformed origin → fall through to deny */
  }
  return false;
}

/** Standard 401 body when a write is rejected. */
export function unauthorized() {
  return { error: "unauthorized — send Authorization: Bearer <API_TOKEN>" };
}
