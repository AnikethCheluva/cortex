import { readAuthorized } from "@/lib/apiauth";
import { NextResponse } from "next/server";
import { readVaultFile } from "@/lib/storage";
import { changelogPath, readChangelog } from "@/lib/changelog/records";
import { todayISO } from "@/lib/day";
import { validTaskDate } from "@/lib/task-dates";
import { authEnabled } from "@/lib/auth";
import { apiAuthorized, unauthorized } from "@/lib/apiauth";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  if (!readAuthorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (authEnabled() && !apiAuthorized(req))
    return NextResponse.json(unauthorized(), { status: 401 });
  const date = new URL(req.url).searchParams.get("date") ?? todayISO();
  if (!date || !validTaskDate(date))
    return NextResponse.json(
      { error: "Use a date in YYYY-MM-DD format" },
      { status: 400 },
    );
  try {
    const file = await readVaultFile(changelogPath(date));
    return NextResponse.json(readChangelog(file?.content ?? null, date), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}
