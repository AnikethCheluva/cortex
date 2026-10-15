// Docs folders. SERVER-ONLY.
//
// Membership lives on each document (`folder:` in its frontmatter), which keeps
// the filesystem flat — every document stays a plain markdown file directly in
// sources/notes/, so slugs, the Obsidian vault and the existing API all keep
// working exactly as before.
//
// This manifest exists for the one thing frontmatter can't express: an EMPTY
// folder. It also gives folders a stable id, so renaming one is a single edit
// here rather than a rewrite of every document inside it.
import { readVaultFile, writeVaultFile } from "./storage";
import type { NoteFolder } from "./types";

export const FOLDERS_PATH = "sources/notes/folders.json";

export function folderSlug(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "folder";
}

export async function readFolders(): Promise<NoteFolder[]> {
  const file = await readVaultFile(FOLDERS_PATH);
  if (!file) return [];
  try {
    const parsed = JSON.parse(file.content);
    const list = Array.isArray(parsed) ? parsed : parsed?.folders;
    if (!Array.isArray(list)) return [];
    return list
      .filter((f) => f && typeof f.id === "string" && typeof f.name === "string")
      .map((f) => ({ id: f.id, name: f.name, created: String(f.created ?? "") }));
  } catch {
    return []; // a corrupt manifest shouldn't take the Docs tab down
  }
}

export async function writeFolders(folders: NoteFolder[], message: string): Promise<void> {
  await writeVaultFile(FOLDERS_PATH, JSON.stringify({ folders }, null, 2) + "\n", message);
}

/** A unique id derived from the name, so the manifest stays readable in git. */
export function uniqueFolderId(name: string, existing: NoteFolder[]): string {
  const base = folderSlug(name);
  const taken = new Set(existing.map((f) => f.id));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 500; i++) {
    const c = `${base}-${i}`;
    if (!taken.has(c)) return c;
  }
  return `${base}-${Date.now()}`;
}
