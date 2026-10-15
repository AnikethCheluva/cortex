import { NextResponse } from "next/server";
import { clearFailures, clientIp, noteFailure, rateLimited, sessionCookie } from "@/lib/auth";
import { googleLoginConfigured, verifyGoogleIdToken } from "@/lib/googleauth";

export const dynamic = "force-dynamic";

// POST { credential } → verify the Google ID token, then set the session cookie.
// The token is checked server-side (signature, audience, expiry, allowlist), so
// a forged or borrowed credential can't get in.
export async function POST(req: Request) {
  if (!googleLoginConfigured()) {
    return NextResponse.json({ error: "Google sign-in is not configured." }, { status: 400 });
  }

  const ip = clientIp(req);
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a few minutes." },
      { status: 429 },
    );
  }

  let credential = "";
  try {
    ({ credential } = (await req.json()) as { credential: string });
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  try {
    const user = await verifyGoogleIdToken(credential);
    clearFailures(ip);
    return NextResponse.json(
      { ok: true, email: user.email, name: user.name },
      { headers: { "Set-Cookie": sessionCookie(), "Cache-Control": "no-store" } },
    );
  } catch (e) {
    noteFailure(ip);
    return NextResponse.json({ error: (e as Error).message }, { status: 401 });
  }
}
