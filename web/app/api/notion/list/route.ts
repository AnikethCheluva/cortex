import { NextResponse } from "next/server";
import { apiAuthorized, unauthorized } from "@/lib/apiauth";
import { listAccessible } from "@/lib/notion";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// POST { token, query? } → the pages/databases this integration can see.
// The token is passed per-request from the browser (it lives in localStorage);
// it is never persisted server-side.
export async function POST(req: Request) {
  if (!apiAuthorized(req)) return NextResponse.json(unauthorized(), { status: 401 });

  let token = "";
  let query = "";
  try {
    const b = (await req.json()) as { token?: string; query?: string };
    token = (b.token ?? "").trim();
    query = b.query ?? "";
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  if (!token) return NextResponse.json({ error: "Missing Notion token." }, { status: 400 });

  try {
    return NextResponse.json(
      { items: await listAccessible(token, query) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
