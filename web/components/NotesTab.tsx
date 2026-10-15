"use client";

// Persistent documents — a Google-Docs-style section. Each document is a real
// wiki SOURCE (sources/notes/<slug>.md), so the next ingest compiles it into the
// wiki. Home = a grid of document + folder cards; opening a document gives a
// full editor (title + the Crepe rich editor) that autosaves back to the repo.
//
// Folders are metadata, not directories: each document records its folder in
// frontmatter and the files stay flat in sources/notes/. That keeps slugs, the
// Obsidian vault and the whole existing API working, and makes dragging a
// document between folders a one-field edit instead of a file move.
import { MacFolderIcon } from "./MacFolderIcon";
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { NoteDocMeta } from "@/lib/types";
import {
  listNotes,
  getNote,
  createNote,
  saveNote,
  deleteNote,
  moveNote,
  listFolders,
  createFolder,
  renameFolder,
  deleteFolder,
  type NoteFolderDTO,
} from "@/lib/clientapi";

// The Docs page editor (top toolbar + blank letter-sized page). Crepe is
// DOM-bound → browser-only.
const DocPageEditor = dynamic(() => import("./DocPageEditor"), {
  ssr: false,
  loading: () => <div className="docpage-wrap" />,
});

function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export function NotesTab() {
  const [notes, setNotes] = useState<NoteDocMeta[] | null>(null);
  const [folders, setFolders] = useState<NoteFolderDTO[]>([]);
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  const [folderMenu, setFolderMenu] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [{ notes }, { folders }] = await Promise.all([listNotes(), listFolders()]);
      setNotes(notes);
      setFolders(folders);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function onNew() {
    setBusy(true);
    setErr("");
    try {
      const doc = await createNote("Untitled document");
      // A document created inside a folder belongs to that folder.
      if (openFolder) await moveNote(doc.slug, openFolder);
      await refresh();
      setOpenSlug(doc.slug);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onNewFolder() {
    setBusy(true);
    setErr("");
    try {
      const f = await createFolder("New folder");
      await refresh();
      // Drop straight into rename, the way Finder does.
      setFolderMenu(null);
                      setRenaming(f.id);
      setDraftName(f.name);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(slug: string) {
    try {
      await deleteNote(slug);
      setOpenSlug(null);
      await refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function commitRename(id: string) {
    const name = draftName.trim();
    setRenaming(null);
    if (!name) return;
    const before = folders;
    setFolders((cur) => cur.map((f) => (f.id === id ? { ...f, name } : f)));
    try {
      await renameFolder(id, name);
    } catch (e) {
      setFolders(before);
      setErr((e as Error).message);
    }
  }

  async function onDeleteFolder(id: string) {
    const f = folders.find((x) => x.id === id);
    const inside = (notes ?? []).filter((n) => n.folder === id).length;
    const msg = inside
      ? `Delete "${f?.name}"? The ${inside} document${inside === 1 ? "" : "s"} inside will move back to All documents — they are not deleted.`
      : `Delete "${f?.name}"?`;
    if (!confirm(msg)) return;
    try {
      await deleteFolder(id);
      if (openFolder === id) setOpenFolder(null);
      await refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  // Drop a document onto a folder (or onto "All documents" to take it out).
  async function drop(slug: string, folder: string) {
    const doc = (notes ?? []).find((n) => n.slug === slug);
    setDragging(null);
    setDropTarget(null);
    if (!doc || (doc.folder ?? "") === folder) return;
    const before = notes;
    setNotes((cur) => (cur ?? []).map((n) => (n.slug === slug ? { ...n, folder } : n)));
    try {
      await moveNote(slug, folder);
    } catch (e) {
      setNotes(before);
      setErr((e as Error).message);
    }
  }

  if (openSlug) {
    return (
      <DocEditor
        slug={openSlug}
        onBack={() => {
          setOpenSlug(null);
          refresh();
        }}
        onDelete={() => onDelete(openSlug)}
      />
    );
  }

  const all = notes ?? [];
  const current = folders.find((f) => f.id === openFolder) ?? null;
  const visible = openFolder
    ? all.filter((n) => n.folder === openFolder)
    : all.filter((n) => !n.folder);
  const countIn = (id: string) => all.filter((n) => n.folder === id).length;

  return (
    <div className="docs">
      <div className="docs-head">
        <div>
          <h2 className="section" data-page-title={!current || undefined} style={{ margin: 0 }}>
            {current ? current.name : "Documents"}
          </h2>
          <div className="muted docs-sub">
            {current
              ? `${visible.length} document${visible.length === 1 ? "" : "s"} in this folder`
              : `${visible.length} document${visible.length === 1 ? "" : "s"}`}
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {!current && (
            <button className="btn" onClick={onNewFolder} disabled={busy}>
              + New folder
            </button>
          )}
          <button className="btn btn-primary" onClick={onNew} disabled={busy}>
            + New document
          </button>
        </div>
      </div>

      {current && (
        <button
          className={`docs-crumb ${dropTarget === "__root__" ? "drop" : ""}`}
          onClick={() => setOpenFolder(null)}
          onDragOver={(e) => {
            if (!dragging) return;
            e.preventDefault();
            setDropTarget("__root__");
          }}
          onDragLeave={() => setDropTarget(null)}
          onDrop={(e) => {
            e.preventDefault();
            if (dragging) drop(dragging, "");
          }}
        >
          ← All documents
          {dragging && <span className="docs-crumb-hint">drop here to move out</span>}
        </button>
      )}

      {err && <div className="banner">{err}</div>}

      {notes === null ? (
        <div className="muted" style={{ padding: "24px 0" }}>
          Loading documents…
        </div>
      ) : (
        <div className="docs-grid">
          {!current &&
            folders.map((f) => (
              <div
                key={f.id}
                className={`doc-card folder-card ${dropTarget === f.id ? "drop" : ""}`}
                onClick={() => renaming !== f.id && setOpenFolder(f.id)}
                onDragOver={(e) => {
                  if (!dragging) return;
                  e.preventDefault();
                  setDropTarget(f.id);
                }}
                onDragLeave={() => setDropTarget((t) => (t === f.id ? null : t))}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragging) drop(dragging, f.id);
                }}
              >
                <MacFolderIcon />
                {renaming === f.id ? (
                  <input
                    className="folder-rename"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onBlur={() => commitRename(f.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename(f.id);
                      if (e.key === "Escape") setRenaming(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus
                  />
                ) : (
                  <div className="doc-card-title">{f.name}</div>
                )}
                <div className="doc-card-meta">
                  {countIn(f.id)} document{countIn(f.id) === 1 ? "" : "s"}
                </div>
                <button className="folder-menu-toggle" aria-label={`Actions for ${f.name}`} aria-expanded={folderMenu === f.id} onClick={(e) => { e.stopPropagation(); setFolderMenu(folderMenu === f.id ? null : f.id); }}>···</button>
                <div className={`folder-actions ${folderMenu === f.id ? "is-open" : ""}`}>
                  <button
                    className="folder-act"
                    title="Rename"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenaming(f.id);
                      setDraftName(f.name);
                    }}
                  >
                    Rename
                  </button>
                  <button
                    className="folder-act danger"
                    title="Delete folder"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFolderMenu(null);
                      onDeleteFolder(f.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}

          {visible.map((n) => (
            <div
              key={n.slug}
              className={`doc-card ${dragging === n.slug ? "is-dragging" : ""}`}
              draggable
              onDragStart={() => setDragging(n.slug)}
              onDragEnd={() => {
                setDragging(null);
                setDropTarget(null);
              }}
              onClick={() => setOpenSlug(n.slug)}
            >
              <div className="doc-card-title">{n.title || "Untitled document"}</div>
              <div className="doc-card-preview">{n.preview || "Empty document"}</div>
              <div className="doc-card-meta">Edited {fmtDate(n.updated)}</div>
            </div>
          ))}

          {visible.length === 0 && (!current ? folders.length === 0 : true) && (
            <div className="empty" style={{ gridColumn: "1 / -1" }}>
              {current
                ? "This folder is empty — drag a document in, or create one here."
                : "No documents yet — click New document to write your first one."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DocEditor({
  slug,
  onBack,
  onDelete,
}: {
  slug: string;
  onBack: () => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState("");
  const [initialBody, setInitialBody] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [savedTitle, setSavedTitle] = useState("");
  const [savedBody, setSavedBody] = useState("");
  const [state, setState] = useState("");
  const [err, setErr] = useState("");
  const loaded = initialBody !== null;
  const dirty = loaded && (title !== savedTitle || body !== savedBody);
  const savingRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // latest values, so the debounced/blur save always sees current state
  const latest = useRef({ title, body, dirty });
  latest.current = { title, body, dirty };

  useEffect(() => {
    let cancelled = false;
    getNote(slug)
      .then((d) => {
        if (cancelled) return;
        setTitle(d.title);
        setSavedTitle(d.title);
        setInitialBody(d.body);
        setBody(d.body);
        setSavedBody(d.body);
      })
      .catch((e) => !cancelled && setErr((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const save = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setState("Saving…");
    setErr("");
    const { title: t, body: b } = latest.current;
    try {
      await saveNote(slug, { title: t.trim() || "Untitled document", body: b });
      setSavedTitle(t);
      setSavedBody(b);
      setState("Saved");
      setTimeout(() => setState((s) => (s === "Saved" ? "" : s)), 1500);
    } catch (e) {
      setErr((e as Error).message);
      setState("");
    } finally {
      savingRef.current = false;
    }
  }, [slug]);

  // debounced autosave whenever the document is dirty
  useEffect(() => {
    if (!dirty) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), 900);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [title, body, dirty, save]);

  async function handleBack() {
    if (latest.current.dirty) await save();
    onBack();
  }

  return (
    <div className="doc-editor">
      <div className="doc-bar">
        <button className="inline-link" onClick={handleBack}>
          ← All documents
        </button>
        <span className="save-state" role="status">
          {err ? "" : state || (dirty ? "unsaved changes" : loaded ? "saved" : "")}
        </span>
        <span className="spacer" />
        <button className="btn small" onClick={() => save()} disabled={!dirty}>
          Save
        </button>
        <button
          className="btn small doc-del"
          onClick={() => {
            if (confirm("Delete this document? This can't be undone.")) onDelete();
          }}
        >
          Delete
        </button>
      </div>

      {err && <div className="banner">{err}</div>}

      <input
        className="doc-title-input"
        aria-label="Document title"
        value={title}
        placeholder="Untitled document"
        onChange={(e) => setTitle(e.target.value)}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
      />

      {initialBody === null ? (
        <div className="docpage-wrap" />
      ) : (
        <DocPageEditor key={slug} initialMarkdown={initialBody} onChange={setBody} />
      )}
    </div>
  );
}
