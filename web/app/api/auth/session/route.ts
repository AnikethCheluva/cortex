import { NextResponse } from "next/server";
import { authEnabled, hasSession, passwordLoginEnabled } from "@/lib/auth";
import { googleClientId, googleConfigProblem, googleLoginConfigured } from "@/lib/googleauth";

export const dynamic = "force-dynamic";

// GET → is a login required here, is this browser signed in, and which methods
// are available (so the sign-in screen only offers what actually works).
export async function GET(req: Request) {
  const google = googleLoginConfigured();
  return NextResponse.json(
    {
      enabled: authEnabled(),
      authed: hasSession(req),
      password: passwordLoginEnabled(),
      google,
      // The client ID is public (it ships in the Calendar bundle already).
      googleClientId: google ? googleClientId() : "",
      // Surfaced only when Google is half-configured, to explain the missing button.
      googleProblem: google ? null : googleConfigProblem(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
