// "Sign in with Google" — SERVER-ONLY verification of the ID token that Google
// Identity Services hands the browser.
//
// The browser gets a signed JWT (the `credential`) and posts it here; we verify
// it locally against Google's published keys — signature, issuer, audience and
// expiry — then check the email against an allowlist. Nothing is trusted from
// the client beyond the token itself, and a token for a different app (wrong
// `aud`) or a different person (not on the list) is rejected.
//
// Config:
//   NEXT_PUBLIC_GOOGLE_CLIENT_ID  the Web OAuth client (already used by Calendar)
//   ALLOWED_EMAILS                comma-separated addresses allowed to sign in
//   AUTH_SECRET                   signs the session cookie (or reuse APP_PASSWORD)
//
// Google login stays OFF unless all three are present — an allowlist-less
// deployment would otherwise let ANY Google account in.
import { createHash, createPublicKey, createVerify, type JsonWebKey } from "crypto";

const CERTS = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);
const SKEW = 60; // seconds of clock tolerance

export function googleClientId(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
}

export function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** All three pieces present? (The session secret is checked by the caller.) */
export function googleLoginConfigured(): boolean {
  const secret = process.env.AUTH_SECRET || process.env.APP_PASSWORD || "";
  return Boolean(googleClientId() && allowedEmails().length && secret);
}

/** Why it's off, for a useful message instead of a silently missing button. */
export function googleConfigProblem(): string | null {
  if (!googleClientId()) return "NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set.";
  if (!allowedEmails().length) return "ALLOWED_EMAILS is not set.";
  if (!(process.env.AUTH_SECRET || process.env.APP_PASSWORD))
    return "AUTH_SECRET (or APP_PASSWORD) is not set — sessions can't be signed.";
  return null;
}

// ---- JWKS -----------------------------------------------------------------
type Jwk = { kid: string; n: string; e: string; kty: string; alg?: string; use?: string };
let cache: { keys: Jwk[]; until: number } | null = null;

async function jwks(): Promise<Jwk[]> {
  if (cache && Date.now() < cache.until) return cache.keys;
  const res = await fetch(CERTS, { cache: "no-store" });
  if (!res.ok) throw new Error(`could not fetch Google's signing keys (${res.status})`);
  const body = (await res.json()) as { keys: Jwk[] };
  // Respect Google's cache hint; fall back to an hour.
  const cc = res.headers.get("cache-control") || "";
  const maxAge = Number(cc.match(/max-age=(\d+)/)?.[1] ?? 3600);
  cache = { keys: body.keys ?? [], until: Date.now() + Math.max(300, maxAge) * 1000 };
  return cache.keys;
}

const b64urlToBuf = (s: string) =>
  Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

function decodeJson(seg: string): Record<string, unknown> {
  try {
    return JSON.parse(b64urlToBuf(seg).toString("utf8"));
  } catch {
    // Never surface a raw parser error to the client — it says nothing useful
    // and leaks internals.
    throw new Error("Malformed sign-in token.");
  }
}

export type GoogleUser = { email: string; name?: string; picture?: string; sub: string };

/**
 * Verify a Google ID token and return the user, or throw with the reason.
 * Checks: RS256 signature against Google's JWKS, issuer, audience, expiry,
 * a verified email, and membership of ALLOWED_EMAILS.
 */
export async function verifyGoogleIdToken(credential: string): Promise<GoogleUser> {
  const parts = (credential || "").split(".");
  if (parts.length !== 3) throw new Error("Malformed sign-in token.");
  const [h, p, sig] = parts;

  const header = decodeJson(h) as { alg?: string; kid?: string };
  if (header.alg !== "RS256") throw new Error("Unexpected token algorithm.");

  const key = (await jwks()).find((k) => k.kid === header.kid);
  if (!key) throw new Error("Sign-in token was not signed by a known Google key.");

  const pub = createPublicKey({ key: key as unknown as JsonWebKey, format: "jwk" });
  const ok = createVerify("RSA-SHA256")
    .update(`${h}.${p}`)
    .verify(pub, b64urlToBuf(sig));
  if (!ok) throw new Error("Sign-in token signature is invalid.");

  const claims = decodeJson(p) as {
    iss?: string;
    aud?: string;
    exp?: number;
    email?: string;
    email_verified?: boolean | string;
    name?: string;
    picture?: string;
    sub?: string;
  };

  if (!claims.iss || !ISSUERS.has(claims.iss)) throw new Error("Unexpected token issuer.");
  if (claims.aud !== googleClientId()) throw new Error("Token was issued for a different app.");
  const now = Math.floor(Date.now() / 1000);
  if (!claims.exp || claims.exp + SKEW < now) throw new Error("Sign-in token has expired.");
  if (claims.email_verified !== true && claims.email_verified !== "true")
    throw new Error("That Google account's email is not verified.");

  const email = (claims.email || "").toLowerCase();
  if (!email) throw new Error("Token carried no email address.");
  if (!allowedEmails().includes(email))
    throw new Error(`${email} is not allowed to sign in to this deployment.`);

  return { email, name: claims.name, picture: claims.picture, sub: claims.sub || "" };
}

/** Stable, non-reversible id for logging a sign-in without storing the address. */
export function emailFingerprint(email: string): string {
  return createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 12);
}
