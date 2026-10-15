import { readAuthorized } from "@/lib/apiauth";
import { NextResponse } from "next/server";
import { apiAuthorized, unauthorized } from "@/lib/apiauth";
import { readFolders, uniqueFolderId, writeFolders } from "@/lib/notefolders";
import { todayISO } from "@/lib/day";

export const dynamic = "force-dynamic";

// GET → every Docs folder.
export async function GET(req: Request) {
  if (!readAuthorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(
    { folders: await readFolders() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

// POST { name } → create a folder.
export async function POST(req: Request) {
  if (!apiAuthorized(req)) return NextResponse.json(unauthorized(), { status: 401 });
  try {
    const { name } = (await req.json()) as { name?: string };
    const clean = (name ?? "").trim().slice(0, 60) || "New folder";
    const folders = await readFolders();
    const folder = { id: uniqueFolderId(clean, folders), name: clean, created: todayISO() };
    await writeFolders([...folders, folder], `notes: add folder ${folder.name}`);
    return NextResponse.json(folder);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
