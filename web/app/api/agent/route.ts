import { readAuthorized } from "@/lib/apiauth";
import { NextResponse } from "next/server";
import { apiAuthorized, unauthorized } from "@/lib/apiauth";
import { bridgeConfigured, bridgeRequest } from "@/lib/agent-bridge";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  if (!readAuthorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!apiAuthorized(req)) return NextResponse.json(unauthorized(), { status: 401 });
  if (!bridgeConfigured())
    return NextResponse.json({ connected: false, message: "Codex is ready to connect." });
  try {
    const health = await bridgeRequest("/health", undefined, 8_000);
    return NextResponse.json({
      connected: Boolean(health?.ready),
      plan: health?.planType || null,
      message: health?.ready ? "Connected through your Codex plan." : "Codex is starting up.",
    });
  } catch (error) {
    return NextResponse.json({
      connected: false,
      message: (error as Error).message,
    });
  }
}

/**
 * A small server-side relay to a user-owned Codex App Server bridge. Vercel
 * cannot reach the Codex desktop process directly, so credentials and the
 * bridge URL stay in server environment variables instead of the browser.
 */
export async function POST(req: Request) {
  if (!apiAuthorized(req)) return NextResponse.json(unauthorized(), { status: 401 });
  const body = await req.json().catch(() => null);
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const context = typeof body?.context === "string" ? body.context.slice(0, 30_000) : "";
  const conversationId = body?.conversationId;
  if (conversationId !== undefined && (typeof conversationId !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(conversationId)))
    return NextResponse.json({ error: "Invalid conversation." }, { status: 400 });
  if (!prompt || prompt.length > 12_000)
    return NextResponse.json({ error: "Enter a prompt under 12,000 characters." }, { status: 400 });

  if (!bridgeConfigured())
    return NextResponse.json(
      { error: "Codex is not connected yet. Add CODEX_BRIDGE_URL to Cortex to enable agent prompts." },
      { status: 503 },
    );
  try {
    const data = await bridgeRequest("/prompt", {
      prompt,
      context,
      mode: "chat",
      source: "cortex",
      ...(conversationId ? { conversationId } : {}),
    });
    return NextResponse.json({ response: String(data?.response || data?.message || "Codex accepted your prompt.") });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
